/* mfrc522.h - MFRC522 RFID Reader Driver Header */

#ifndef MFRC522_H
#define MFRC522_H

#include "main.h"
#include <stdint.h>
#include <stdbool.h>

/* MFRC522 Registers */
#define MFRC522_REG_COMMAND       0x01
#define MFRC522_REG_COMM_IEN      0x02
#define MFRC522_REG_DIV_IEN       0x03
#define MFRC522_REG_COMM_IRQ      0x04
#define MFRC522_REG_DIV_IRQ       0x05
#define MFRC522_REG_ERROR         0x06
#define MFRC522_REG_STATUS_1      0x07
#define MFRC522_REG_STATUS_2      0x08
#define MFRC522_REG_FIFO_DATA     0x09
#define MFRC522_REG_FIFO_LEVEL    0x0A
#define MFRC522_REG_WATER_LEVEL   0x0B
#define MFRC522_REG_CONTROL       0x0C
#define MFRC522_REG_BIT_FRAMING   0x0D
#define MFRC522_REG_COLL          0x0E
#define MFRC522_REG_MODE          0x11
#define MFRC522_REG_TX_MODE       0x12
#define MFRC522_REG_RX_MODE       0x13
#define MFRC522_REG_TX_CONTROL    0x14
#define MFRC522_REG_TX_ASK        0x15
#define MFRC522_REG_TX_SEL        0x16
#define MFRC522_REG_RX_SEL        0x17
#define MFRC522_REG_RX_THRESHOLD  0x18
#define MFRC522_REG_DEMOD         0x19
#define MFRC522_REG_MF_TX         0x1C
#define MFRC522_REG_MF_RX         0x1D
#define MFRC522_REG_SERIAL_SPEED  0x1F
#define MFRC522_REG_CRC_RESULT_H  0x21
#define MFRC522_REG_CRC_RESULT_L  0x22
#define MFRC522_REG_MOD_WIDTH     0x24
#define MFRC522_REG_RF_CFG        0x26
#define MFRC522_REG_GS_N          0x27
#define MFRC522_REG_CW_GS_P       0x28
#define MFRC522_REG_MOD_GS_P      0x29
#define MFRC522_REG_T_MODE        0x2A
#define MFRC522_REG_T_PRESCALER   0x2B
#define MFRC522_REG_T_RELOAD_H    0x2C
#define MFRC522_REG_T_RELOAD_L    0x2D
#define MFRC522_REG_T_COUNTER_VAL_H 0x2E
#define MFRC522_REG_T_COUNTER_VAL_L 0x2F
#define MFRC522_REG_VERSION       0x37

/* MFRC522 Commands */
#define MFRC522_CMD_IDLE          0x00
#define MFRC522_CMD_MEM           0x01
#define MFRC522_CMD_GENERATE_RANDOM_ID 0x02
#define MFRC522_CMD_CALC_CRC      0x03
#define MFRC522_CMD_TRANSMIT      0x04
#define MFRC522_CMD_NO_CMD_CHANGE 0x07
#define MFRC522_CMD_RECEIVE       0x08
#define MFRC522_CMD_TRANSCEIVE    0x0C
#define MFRC522_CMD_MF_AUTHENT    0x0E
#define MFRC522_CMD_SOFT_RESET    0x0F

/* PICC Commands */
#define PICC_CMD_REQA             0x26
#define PICC_CMD_WUPA             0x52
#define PICC_CMD_CT               0x88
#define PICC_CMD_SEL_CL1          0x93
#define PICC_CMD_SEL_CL2          0x95
#define PICC_CMD_SEL_CL3          0x97
#define PICC_CMD_HLTA             0x50
#define PICC_CMD_MF_AUTH_KEY_A    0x60
#define PICC_CMD_MF_AUTH_KEY_B    0x61
#define PICC_CMD_MF_READ          0x30
#define PICC_CMD_MF_WRITE         0xA0

/* Status codes */
typedef enum {
    MFRC522_OK = 0,
    MFRC522_NOTAGERR,
    MFRC522_ERR,
    MFRC522_TIMEOUT,
    MFRC522_COLLISION
} MFRC522_Status_t;

/* MIFARE Card types */
typedef enum {
    PICC_TYPE_UNKNOWN = 0,
    PICC_TYPE_MIFARE_MINI,
    PICC_TYPE_MIFARE_1K,
    PICC_TYPE_MIFARE_4K,
    PICC_TYPE_MIFARE_UL,
    PICC_TYPE_MIFARE_PLUS,
    PICC_TYPE_TNP3XXX,
    PICC_TYPE_NOT_COMPLETE
} PICC_Type_t;

/* UID structure */
typedef struct {
    uint8_t size;
    uint8_t uidByte[10];
    uint8_t sak;
} Uid_t;

/* Configuration structure */
typedef struct {
    SPI_HandleTypeDef *hspi;
    GPIO_TypeDef *CS_GPIO_Port;
    uint16_t CS_Pin;
    GPIO_TypeDef *RST_GPIO_Port;
    uint16_t RST_Pin;
} MFRC522_Config_t;

/* Function prototypes */
void MFRC522_Init(MFRC522_Config_t *config);
void MFRC522_Reset(void);
bool MFRC522_Check(uint8_t *version);
void MFRC522_AntennaOn(void);
void MFRC522_AntennaOff(void);

MFRC522_Status_t MFRC522_Request(uint8_t reqMode, uint8_t *tagType);
MFRC522_Status_t MFRC522_Anticoll(Uid_t *uid);
MFRC522_Status_t MFRC522_SelectTag(Uid_t *uid);
MFRC522_Status_t MFRC522_Auth(uint8_t authMode, uint8_t blockAddr, uint8_t *key, Uid_t *uid);
MFRC522_Status_t MFRC522_Read(uint8_t blockAddr, uint8_t *recvData);
MFRC522_Status_t MFRC522_Write(uint8_t blockAddr, uint8_t *writeData);
void MFRC522_Halt(void);

PICC_Type_t MFRC522_GetType(uint8_t sak);
const char* MFRC522_GetTypeName(PICC_Type_t type);

/* Low-level functions */
void MFRC522_WriteRegister(uint8_t reg, uint8_t value);
uint8_t MFRC522_ReadRegister(uint8_t reg);
void MFRC522_SetBitMask(uint8_t reg, uint8_t mask);
void MFRC522_ClearBitMask(uint8_t reg, uint8_t mask);
MFRC522_Status_t MFRC522_ToCard(uint8_t command, uint8_t *sendData, uint8_t sendLen,
                                 uint8_t *backData, uint16_t *backLen);
void MFRC522_CalculateCRC(uint8_t *data, uint8_t len, uint8_t *result);

#endif /* MFRC522_H */
