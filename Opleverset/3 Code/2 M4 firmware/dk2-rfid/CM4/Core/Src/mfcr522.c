/* mfrc522.c - MFRC522 RFID Reader Driver Implementation */

#include "mfrc522.h"
#include <string.h>

static MFRC522_Config_t mfrc522_config;

/* Chip Select control */
#define MFRC522_CS_LOW()   HAL_GPIO_WritePin(mfrc522_config.CS_GPIO_Port, mfrc522_config.CS_Pin, GPIO_PIN_RESET)
#define MFRC522_CS_HIGH()  HAL_GPIO_WritePin(mfrc522_config.CS_GPIO_Port, mfrc522_config.CS_Pin, GPIO_PIN_SET)
#define MFRC522_RST_LOW()  HAL_GPIO_WritePin(mfrc522_config.RST_GPIO_Port, mfrc522_config.RST_Pin, GPIO_PIN_RESET)
#define MFRC522_RST_HIGH() HAL_GPIO_WritePin(mfrc522_config.RST_GPIO_Port, mfrc522_config.RST_Pin, GPIO_PIN_SET)

/* Initialize MFRC522 */
void MFRC522_Init(MFRC522_Config_t *config) {
    memcpy(&mfrc522_config, config, sizeof(MFRC522_Config_t));

    MFRC522_CS_HIGH();
    MFRC522_RST_HIGH();
    HAL_Delay(10);

    MFRC522_Reset();

    // Timer: TPrescaler*TreloadVal/6.78MHz = 24ms
    MFRC522_WriteRegister(MFRC522_REG_T_MODE, 0x8D);
    MFRC522_WriteRegister(MFRC522_REG_T_PRESCALER, 0x3E);
    MFRC522_WriteRegister(MFRC522_REG_T_RELOAD_L, 30);
    MFRC522_WriteRegister(MFRC522_REG_T_RELOAD_H, 0);

    MFRC522_WriteRegister(MFRC522_REG_TX_ASK, 0x40);
    MFRC522_WriteRegister(MFRC522_REG_MODE, 0x3D);

    MFRC522_AntennaOn();
}

/* Reset the MFRC522 */
void MFRC522_Reset(void) {
    MFRC522_WriteRegister(MFRC522_REG_COMMAND, MFRC522_CMD_SOFT_RESET);
    HAL_Delay(50);
}

/* Check if MFRC522 is present */
bool MFRC522_Check(uint8_t *version) {
    *version = MFRC522_ReadRegister(MFRC522_REG_VERSION);
    return (*version == 0x91 || *version == 0x92);
}

/* Turn on antenna */
void MFRC522_AntennaOn(void) {
    uint8_t temp = MFRC522_ReadRegister(MFRC522_REG_TX_CONTROL);
    if (!(temp & 0x03)) {
        MFRC522_SetBitMask(MFRC522_REG_TX_CONTROL, 0x03);
    }
}

/* Turn off antenna */
void MFRC522_AntennaOff(void) {
    MFRC522_ClearBitMask(MFRC522_REG_TX_CONTROL, 0x03);
}

/* Write to MFRC522 register */
void MFRC522_WriteRegister(uint8_t reg, uint8_t value) {
    uint8_t txData[2];
    txData[0] = (reg << 1) & 0x7E;
    txData[1] = value;

    MFRC522_CS_LOW();
    HAL_SPI_Transmit(mfrc522_config.hspi, txData, 2, 100);
    MFRC522_CS_HIGH();
}

/* Read from MFRC522 register */
uint8_t MFRC522_ReadRegister(uint8_t reg) {
    uint8_t txData = ((reg << 1) & 0x7E) | 0x80;
    uint8_t rxData = 0;

    MFRC522_CS_LOW();
    HAL_SPI_Transmit(mfrc522_config.hspi, &txData, 1, 100);
    HAL_SPI_Receive(mfrc522_config.hspi, &rxData, 1, 100);
    MFRC522_CS_HIGH();

    return rxData;
}

/* Set bit mask in register */
void MFRC522_SetBitMask(uint8_t reg, uint8_t mask) {
    uint8_t tmp = MFRC522_ReadRegister(reg);
    MFRC522_WriteRegister(reg, tmp | mask);
}

/* Clear bit mask in register */
void MFRC522_ClearBitMask(uint8_t reg, uint8_t mask) {
    uint8_t tmp = MFRC522_ReadRegister(reg);
    MFRC522_WriteRegister(reg, tmp & (~mask));
}

/* Calculate CRC */
void MFRC522_CalculateCRC(uint8_t *data, uint8_t len, uint8_t *result) {
    MFRC522_ClearBitMask(MFRC522_REG_DIV_IRQ, 0x04);
    MFRC522_SetBitMask(MFRC522_REG_FIFO_LEVEL, 0x80);

    for (uint8_t i = 0; i < len; i++) {
        MFRC522_WriteRegister(MFRC522_REG_FIFO_DATA, data[i]);
    }

    MFRC522_WriteRegister(MFRC522_REG_COMMAND, MFRC522_CMD_CALC_CRC);

    uint16_t timeout = 5000;
    uint8_t n;
    do {
        n = MFRC522_ReadRegister(MFRC522_REG_DIV_IRQ);
        timeout--;
    } while ((timeout != 0) && !(n & 0x04));

    result[0] = MFRC522_ReadRegister(MFRC522_REG_CRC_RESULT_L);
    result[1] = MFRC522_ReadRegister(MFRC522_REG_CRC_RESULT_H);
}

/* Communicate with PICC */
MFRC522_Status_t MFRC522_ToCard(uint8_t command, uint8_t *sendData, uint8_t sendLen,
                                 uint8_t *backData, uint16_t *backLen) {
    MFRC522_Status_t status = MFRC522_ERR;
    uint8_t irqEn = 0x00;
    uint8_t waitIRq = 0x00;
    uint8_t lastBits;
    uint8_t n;
    uint16_t i;

    switch (command) {
        case MFRC522_CMD_MF_AUTHENT:
            irqEn = 0x12;
            waitIRq = 0x10;
            break;
        case MFRC522_CMD_TRANSCEIVE:
            irqEn = 0x77;
            waitIRq = 0x30;
            break;
        default:
            break;
    }

    MFRC522_WriteRegister(MFRC522_REG_COMM_IEN, irqEn | 0x80);
    MFRC522_ClearBitMask(MFRC522_REG_COMM_IRQ, 0x80);
    MFRC522_SetBitMask(MFRC522_REG_FIFO_LEVEL, 0x80);
    MFRC522_WriteRegister(MFRC522_REG_COMMAND, MFRC522_CMD_IDLE);

    for (i = 0; i < sendLen; i++) {
        MFRC522_WriteRegister(MFRC522_REG_FIFO_DATA, sendData[i]);
    }

    MFRC522_WriteRegister(MFRC522_REG_COMMAND, command);

    if (command == MFRC522_CMD_TRANSCEIVE) {
        MFRC522_SetBitMask(MFRC522_REG_BIT_FRAMING, 0x80);
    }

    i = 2000;
    do {
        n = MFRC522_ReadRegister(MFRC522_REG_COMM_IRQ);
        i--;
    } while ((i != 0) && !(n & 0x01) && !(n & waitIRq));

    MFRC522_ClearBitMask(MFRC522_REG_BIT_FRAMING, 0x80);

    if (i != 0) {
        if (!(MFRC522_ReadRegister(MFRC522_REG_ERROR) & 0x1B)) {
            status = MFRC522_OK;

            if (n & irqEn & 0x01) {
                status = MFRC522_NOTAGERR;
            }

            if (command == MFRC522_CMD_TRANSCEIVE) {
                n = MFRC522_ReadRegister(MFRC522_REG_FIFO_LEVEL);
                lastBits = MFRC522_ReadRegister(MFRC522_REG_CONTROL) & 0x07;

                if (lastBits) {
                    *backLen = (n - 1) * 8 + lastBits;
                } else {
                    *backLen = n * 8;
                }

                if (n == 0) {
                    n = 1;
                }
                if (n > 16) {
                    n = 16;
                }

                for (i = 0; i < n; i++) {
                    backData[i] = MFRC522_ReadRegister(MFRC522_REG_FIFO_DATA);
                }
            }
        } else {
            status = MFRC522_ERR;
        }
    }

    return status;
}

/* Request tag */
MFRC522_Status_t MFRC522_Request(uint8_t reqMode, uint8_t *tagType) {
    MFRC522_Status_t status;
    uint16_t backBits;

    MFRC522_WriteRegister(MFRC522_REG_BIT_FRAMING, 0x07);

    tagType[0] = reqMode;
    status = MFRC522_ToCard(MFRC522_CMD_TRANSCEIVE, tagType, 1, tagType, &backBits);

    if ((status != MFRC522_OK) || (backBits != 0x10)) {
        status = MFRC522_ERR;
    }

    return status;
}

/* Anti-collision detection */
MFRC522_Status_t MFRC522_Anticoll(Uid_t *uid) {
    MFRC522_Status_t status;
    uint8_t i;
    uint8_t serNumCheck = 0;
    uint16_t unLen;

    MFRC522_WriteRegister(MFRC522_REG_BIT_FRAMING, 0x00);

    uint8_t serNum[2];
    serNum[0] = PICC_CMD_SEL_CL1;
    serNum[1] = 0x20;

    status = MFRC522_ToCard(MFRC522_CMD_TRANSCEIVE, serNum, 2, serNum, &unLen);

    if (status == MFRC522_OK) {
        for (i = 0; i < 4; i++) {
            uid->uidByte[i] = serNum[i];
            serNumCheck ^= serNum[i];
        }

        if (serNumCheck != serNum[i]) {
            status = MFRC522_ERR;
        }

        uid->size = 4;
    }

    return status;
}

/* Select tag */
MFRC522_Status_t MFRC522_SelectTag(Uid_t *uid) {
    MFRC522_Status_t status;
    uint8_t i;
    uint16_t recvBits;
    uint8_t buffer[9];

    buffer[0] = PICC_CMD_SEL_CL1;
    buffer[1] = 0x70;

    for (i = 0; i < 4; i++) {
        buffer[i + 2] = uid->uidByte[i];
    }

    buffer[6] = buffer[2] ^ buffer[3] ^ buffer[4] ^ buffer[5];

    MFRC522_CalculateCRC(buffer, 7, &buffer[7]);

    status = MFRC522_ToCard(MFRC522_CMD_TRANSCEIVE, buffer, 9, buffer, &recvBits);

    if ((status == MFRC522_OK) && (recvBits == 0x18)) {
        uid->sak = buffer[0];
        status = MFRC522_OK;
    } else {
        status = MFRC522_ERR;
    }

    return status;
}

/* Authenticate */
MFRC522_Status_t MFRC522_Auth(uint8_t authMode, uint8_t blockAddr, uint8_t *key, Uid_t *uid) {
    MFRC522_Status_t status;
    uint16_t recvBits;
    uint8_t i;
    uint8_t buff[12];

    buff[0] = authMode;
    buff[1] = blockAddr;

    for (i = 0; i < 6; i++) {
        buff[i + 2] = key[i];
    }

    for (i = 0; i < 4; i++) {
        buff[i + 8] = uid->uidByte[i];
    }

    status = MFRC522_ToCard(MFRC522_CMD_MF_AUTHENT, buff, 12, buff, &recvBits);

    if ((status != MFRC522_OK) || (!(MFRC522_ReadRegister(MFRC522_REG_STATUS_2) & 0x08))) {
        status = MFRC522_ERR;
    }

    return status;
}

/* Read block */
MFRC522_Status_t MFRC522_Read(uint8_t blockAddr, uint8_t *recvData) {
    MFRC522_Status_t status;
    uint16_t unLen;

    recvData[0] = PICC_CMD_MF_READ;
    recvData[1] = blockAddr;

    MFRC522_CalculateCRC(recvData, 2, &recvData[2]);

    status = MFRC522_ToCard(MFRC522_CMD_TRANSCEIVE, recvData, 4, recvData, &unLen);

    if ((status != MFRC522_OK) || (unLen != 0x90)) {
        status = MFRC522_ERR;
    }

    return status;
}

/* Write block */
MFRC522_Status_t MFRC522_Write(uint8_t blockAddr, uint8_t *writeData) {
    MFRC522_Status_t status;
    uint16_t recvBits;
    uint8_t i;
    uint8_t buff[18];

    buff[0] = PICC_CMD_MF_WRITE;
    buff[1] = blockAddr;
    MFRC522_CalculateCRC(buff, 2, &buff[2]);

    status = MFRC522_ToCard(MFRC522_CMD_TRANSCEIVE, buff, 4, buff, &recvBits);

    if ((status != MFRC522_OK) || (recvBits != 4) || ((buff[0] & 0x0F) != 0x0A)) {
        status = MFRC522_ERR;
    }

    if (status == MFRC522_OK) {
        for (i = 0; i < 16; i++) {
            buff[i] = writeData[i];
        }

        MFRC522_CalculateCRC(buff, 16, &buff[16]);
        status = MFRC522_ToCard(MFRC522_CMD_TRANSCEIVE, buff, 18, buff, &recvBits);

        if ((status != MFRC522_OK) || (recvBits != 4) || ((buff[0] & 0x0F) != 0x0A)) {
            status = MFRC522_ERR;
        }
    }

    return status;
}

/* Halt tag */
void MFRC522_Halt(void) {
    uint16_t unLen;
    uint8_t buff[4];

    buff[0] = PICC_CMD_HLTA;
    buff[1] = 0;
    MFRC522_CalculateCRC(buff, 2, &buff[2]);

    MFRC522_ToCard(MFRC522_CMD_TRANSCEIVE, buff, 4, buff, &unLen);
}

/* Get card type */
PICC_Type_t MFRC522_GetType(uint8_t sak) {
    if (sak & 0x04) {
        return PICC_TYPE_NOT_COMPLETE;
    }

    switch (sak) {
        case 0x09: return PICC_TYPE_MIFARE_MINI;
        case 0x08: return PICC_TYPE_MIFARE_1K;
        case 0x18: return PICC_TYPE_MIFARE_4K;
        case 0x00: return PICC_TYPE_MIFARE_UL;
        case 0x10:
        case 0x11: return PICC_TYPE_MIFARE_PLUS;
        case 0x01: return PICC_TYPE_TNP3XXX;
        default: return PICC_TYPE_UNKNOWN;
    }
}

/* Get card type name */
const char* MFRC522_GetTypeName(PICC_Type_t type) {
    switch (type) {
        case PICC_TYPE_MIFARE_MINI: return "MIFARE Mini";
        case PICC_TYPE_MIFARE_1K: return "MIFARE 1KB";
        case PICC_TYPE_MIFARE_4K: return "MIFARE 4KB";
        case PICC_TYPE_MIFARE_UL: return "MIFARE Ultralight";
        case PICC_TYPE_MIFARE_PLUS: return "MIFARE Plus";
        case PICC_TYPE_TNP3XXX: return "MIFARE TNP3XXX";
        case PICC_TYPE_NOT_COMPLETE: return "SAK incomplete";
        default: return "Unknown";
    }
}
