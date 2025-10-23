/* USER CODE BEGIN Header */
/* USER CODE END Header */
/* Includes ------------------------------------------------------------------*/
#include "main.h"
#include "openamp.h"

/* Private includes ----------------------------------------------------------*/
/* USER CODE BEGIN Includes */
#include <string.h>
#include "virt_uart.h"
#include <stdio.h>
#include <stdarg.h>
#include "mfrc522.h"
/* USER CODE END Includes */

/* Private typedef -----------------------------------------------------------*/
/* USER CODE BEGIN PTD */
typedef enum {
    CMD_NONE = 0,
    CMD_READ_CARD,
    CMD_SCAN_ONCE,
    CMD_GET_STATUS,
    CMD_WRITE_BLOCK,
    CMD_READ_BLOCK
} Command_t;
/* USER CODE END PTD */

/* Private define ------------------------------------------------------------*/
/* USER CODE BEGIN PD */
#define RX_BUFFER_SIZE 256
/* USER CODE END PD */

/* Private macro -------------------------------------------------------------*/
/* USER CODE BEGIN PM */
/* USER CODE END PM */

/* Private variables ---------------------------------------------------------*/
IPCC_HandleTypeDef hipcc;
SPI_HandleTypeDef hspi5;

/* USER CODE BEGIN PV */
VIRT_UART_HandleTypeDef huart0;
MFRC522_Config_t mfrc522;
Uid_t uid;
uint8_t keyA[6] = {0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF};
uint8_t readBuffer[18];

// Command processing variables
volatile Command_t pendingCommand = CMD_NONE;
char rxBuffer[RX_BUFFER_SIZE];
volatile uint16_t rxIndex = 0;
volatile uint8_t commandReady = 0;

// Additional command parameters
uint8_t cmdBlockAddr = 4;
uint8_t cmdWriteData[16];
/* USER CODE END PV */

/* Private function prototypes -----------------------------------------------*/
void SystemClock_Config(void);
void PeriphCommonClock_Config(void);
static void MX_GPIO_Init(void);
static void MX_DMA_Init(void);
static void MX_IPCC_Init(void);
static void MX_SPI5_Init(void);
int MX_OPENAMP_Init(int RPMsgRole, rpmsg_ns_bind_cb ns_bind_cb);

/* USER CODE BEGIN PFP */
void VIRT_UART_RxCpltCallback(VIRT_UART_HandleTypeDef *huart);
void qprint(const char* format, ...);
void ProcessCommand(char* cmd);
void ExecuteScanOnce(void);
void ExecuteReadBlock(uint8_t blockAddr);
void ExecuteWriteBlock(uint8_t blockAddr, uint8_t* data);
/* USER CODE END PFP */

/* Private user code ---------------------------------------------------------*/
/* USER CODE BEGIN 0 */
/* USER CODE END 0 */

int main(void)
{
    /* USER CODE BEGIN 1 */
    /* USER CODE END 1 */

    HAL_Init();

    /* USER CODE BEGIN Init */
    /* USER CODE END Init */

    if(IS_ENGINEERING_BOOT_MODE())
    {
        SystemClock_Config();
    }

    if(IS_ENGINEERING_BOOT_MODE())
    {
        PeriphCommonClock_Config();
    }
    else
    {
        MX_IPCC_Init();
        MX_OPENAMP_Init(RPMSG_REMOTE, NULL);
    }

    /* USER CODE BEGIN SysInit */
    /* USER CODE END SysInit */

    MX_GPIO_Init();
    MX_DMA_Init();
    MX_SPI5_Init();

    /* USER CODE BEGIN 2 */
    // Initialize MFRC522
    mfrc522.hspi = &hspi5;
    mfrc522.CS_GPIO_Port = GPIOD;
    mfrc522.CS_Pin = GPIO_PIN_14;
    mfrc522.RST_GPIO_Port = GPIOD;
    mfrc522.RST_Pin = GPIO_PIN_15;

    MFRC522_Init(&mfrc522);

    // Initialize Virtual UART
    VIRT_UART_Init(&huart0);
    if(VIRT_UART_RegisterCallback(&huart0, VIRT_UART_RXCPLT_CB_ID, VIRT_UART_RxCpltCallback) != VIRT_UART_OK) {
        Error_Handler();
    }

    // Send startup message
    qprint("\r\n=== M4 Core Started ===\r\n");
    qprint("RFID Reader Ready\r\n");
    qprint("Available commands:\r\n");
    qprint("  scan        - Scan for card once\r\n");
    qprint("  status      - Get system status\r\n");
    qprint("  read:N      - Read block N (e.g., read:4)\r\n");
    qprint("  write:N:DATA - Write to block N\r\n");
    qprint("===================\r\n\r\n");

    /* USER CODE END 2 */

    /* Infinite loop */
    /* USER CODE BEGIN WHILE */
    uint32_t lastAutoScan = 0;
    uint8_t autoScanEnabled = 1; // Auto-scan by default

    while (1)
    {
        /* USER CODE END WHILE */

        /* USER CODE BEGIN 3 */

        // Check for incoming messages
        OPENAMP_check_for_message();

        // Process any pending commands from A7
        if (commandReady) {
            commandReady = 0;
            ProcessCommand(rxBuffer);
            rxIndex = 0;
            memset(rxBuffer, 0, RX_BUFFER_SIZE);
        }

        // Auto-scan mode (can be disabled via command)
        /*if (autoScanEnabled && (HAL_GetTick() - lastAutoScan > 100)) {
            lastAutoScan = HAL_GetTick();

            uint8_t tagType[2];
            MFRC522_Status_t status = MFRC522_Request(PICC_CMD_REQA, tagType);

            if (status == MFRC522_OK) {
                ExecuteScanOnce();
            }
        }*/

        uint8_t tagType[2];
        MFRC522_Status_t status = MFRC522_Request(PICC_CMD_REQA, tagType);

        if (status == MFRC522_OK) {
            qprint("\r\n=== Card Detected ===\r\n");

            // Anti-collision detection, get card UID
            status = MFRC522_Anticoll(&uid);

            if (status == MFRC522_OK) {
                qprint("Card UID: ");
                for (uint8_t i = 0; i < uid.size; i++) {
                    qprint("%02X ", uid.uidByte[i]);
                }
                qprint("\r\n");

                // Select the card
                status = MFRC522_SelectTag(&uid);

                if (status == MFRC522_OK) {
                    PICC_Type_t cardType = MFRC522_GetType(uid.sak);
                    qprint("Card Type: %s\r\n", MFRC522_GetTypeName(cardType));
                    qprint("SAK: 0x%02X\r\n", uid.sak);

                    // Example: Read block 4 (first data block of sector 1)
                    uint8_t blockAddr = 4;

                    // Authenticate with Key A
                    status = MFRC522_Auth(PICC_CMD_MF_AUTH_KEY_A, blockAddr, keyA, &uid);

                    if (status == MFRC522_OK) {
                        qprint("Authentication successful!\r\n");

                        // Read the block
                        status = MFRC522_Read(blockAddr, readBuffer);

                        if (status == MFRC522_OK) {
                            qprint("Block %d data: ", blockAddr);
                            for (uint8_t i = 0; i < 16; i++) {
                                qprint("%02X ", readBuffer[i]);
                            }
                            qprint("\r\n");

                            // Print as ASCII (if printable)
                            qprint("ASCII: ");
                            for (uint8_t i = 0; i < 16; i++) {
                                if (readBuffer[i] >= 0x20 && readBuffer[i] <= 0x7E) {
                                    qprint("%c", readBuffer[i]);
                                } else {
                                    qprint(".");
                                }
                            }
                            qprint("\r\n");

                        } else {
                            qprint("Failed to read block %d\r\n", blockAddr);
                        }

                    } else {
                        qprint("Authentication failed!\r\n");
                    }
                }
            }

            // CRITICAL: Halt the card and stop crypto
            MFRC522_Halt();

            // Clear the MFCrypto1On bit to stop encryption
            MFRC522_ClearBitMask(MFRC522_REG_STATUS_2, 0x08);

            qprint("=== End ===\r\n\r\n");

            // Wait a bit to prevent multiple rapid reads of the same card
            HAL_Delay(500);

        } else {
            // No card detected, small delay before next attempt
            HAL_Delay(50);
        }

        //HAL_Delay(10);
    }
    /* USER CODE END 3 */
}

/* USER CODE BEGIN 4 */

/**
 * @brief Callback when data received from A7 core
 * The data is already in huart->pRxBuffPtr
 */
void VIRT_UART_RxCpltCallback(VIRT_UART_HandleTypeDef *huart)
{
    // Data is automatically in the RX buffer
    // huart->RxXferSize contains the number of bytes received

    for (uint16_t i = 0; i < huart->RxXferSize; i++) {
        uint8_t data = huart->pRxBuffPtr[i];

        if (data == '\n' || data == '\r') {
            // End of command
            if (rxIndex > 0) {
                rxBuffer[rxIndex] = '\0';
                commandReady = 1;
                rxIndex = 0;  // Reset for next command
            }
        } else if (rxIndex < RX_BUFFER_SIZE - 1) {
            // Add to buffer
            rxBuffer[rxIndex++] = data;
        }
    }
}

/**
 * @brief Process incoming command from A7
 */
void ProcessCommand(char* cmd)
{
    // Trim whitespace
    while (*cmd == ' ' || *cmd == '\t') cmd++;

    qprint("RX: %s\r\n", cmd);

    if (strncmp(cmd, "scan", 4) == 0) {
        qprint(">> Scanning for card...\r\n");
        ExecuteScanOnce();

    } else if (strncmp(cmd, "status", 6) == 0) {
        qprint(">> Status:\r\n");
        qprint("   M4 Core: Running\r\n");
        qprint("   RFID: OK\r\n");
        qprint("   Uptime: %lu ms\r\n", HAL_GetTick());

    } else if (strncmp(cmd, "read:", 5) == 0) {
        // Parse block number
        uint8_t blockNum = atoi(cmd + 5);
        qprint(">> Reading block %d...\r\n", blockNum);
        ExecuteReadBlock(blockNum);

    } else if (strncmp(cmd, "write:", 6) == 0) {
        // Parse: write:4:Hello World
        char* blockStr = cmd + 6;
        char* dataStr = strchr(blockStr, ':');

        if (dataStr != NULL) {
            *dataStr = '\0';
            dataStr++;

            uint8_t blockNum = atoi(blockStr);

            // Prepare 16-byte data (pad with spaces)
            memset(cmdWriteData, ' ', 16);
            strncpy((char*)cmdWriteData, dataStr, 16);

            qprint(">> Writing to block %d...\r\n", blockNum);
            ExecuteWriteBlock(blockNum, cmdWriteData);
        } else {
            qprint("ERROR: Invalid write format. Use: write:BLOCK:DATA\r\n");
        }

    } else if (strncmp(cmd, "help", 4) == 0) {
        qprint(">> Available commands:\r\n");
        qprint("   scan           - Scan for card once\r\n");
        qprint("   status         - Get system status\r\n");
        qprint("   read:N         - Read block N\r\n");
        qprint("   write:N:DATA   - Write DATA to block N\r\n");
        qprint("   help           - Show this help\r\n");

    } else {
        qprint("ERROR: Unknown command '%s'. Type 'help' for commands.\r\n", cmd);
    }
}

/**
 * @brief Execute a single card scan
 */
void ExecuteScanOnce(void)
{
    uint8_t tagType[2];
    MFRC522_Status_t status = MFRC522_Request(PICC_CMD_REQA, tagType);

    if (status != MFRC522_OK) {
        qprint("No card detected\r\n");
        return;
    }

    qprint("\r\n=== Card Detected ===\r\n");

    status = MFRC522_Anticoll(&uid);
    if (status != MFRC522_OK) {
        qprint("ERROR: Anticollision failed\r\n");
        return;
    }

    qprint("UID: ");
    for (uint8_t i = 0; i < uid.size; i++) {
        qprint("%02X ", uid.uidByte[i]);
    }
    qprint("\r\n");

    status = MFRC522_SelectTag(&uid);
    if (status == MFRC522_OK) {
        PICC_Type_t cardType = MFRC522_GetType(uid.sak);
        qprint("Type: %s\r\n", MFRC522_GetTypeName(cardType));
        qprint("SAK: 0x%02X\r\n", uid.sak);
    }

    MFRC522_Halt();
    qprint("=== End ===\r\n\r\n");
}

/**
 * @brief Read a specific block
 */
void ExecuteReadBlock(uint8_t blockAddr)
{
    uint8_t tagType[2];
    MFRC522_Status_t status = MFRC522_Request(PICC_CMD_REQA, tagType);

    if (status != MFRC522_OK) {
        qprint("ERROR: No card present\r\n");
        return;
    }

    status = MFRC522_Anticoll(&uid);
    if (status != MFRC522_OK) {
        qprint("ERROR: Anticollision failed\r\n");
        return;
    }

    status = MFRC522_SelectTag(&uid);
    if (status != MFRC522_OK) {
        qprint("ERROR: Card select failed\r\n");
        return;
    }

    // Authenticate
    status = MFRC522_Auth(PICC_CMD_MF_AUTH_KEY_A, blockAddr, keyA, &uid);
    if (status != MFRC522_OK) {
        qprint("ERROR: Authentication failed\r\n");
        MFRC522_Halt();
        return;
    }

    // Read block
    status = MFRC522_Read(blockAddr, readBuffer);
    if (status == MFRC522_OK) {
        qprint("Block %d HEX: ", blockAddr);
        for (uint8_t i = 0; i < 16; i++) {
            qprint("%02X ", readBuffer[i]);
        }
        qprint("\r\n");

        qprint("Block %d ASCII: ", blockAddr);
        for (uint8_t i = 0; i < 16; i++) {
            if (readBuffer[i] >= 0x20 && readBuffer[i] <= 0x7E) {
                qprint("%c", readBuffer[i]);
            } else {
                qprint(".");
            }
        }
        qprint("\r\n");
    } else {
        qprint("ERROR: Read failed\r\n");
    }

    MFRC522_Halt();
}

/**
 * @brief Write data to a specific block
 */
void ExecuteWriteBlock(uint8_t blockAddr, uint8_t* data)
{
    uint8_t tagType[2];
    MFRC522_Status_t status = MFRC522_Request(PICC_CMD_REQA, tagType);

    if (status != MFRC522_OK) {
        qprint("ERROR: No card present\r\n");
        return;
    }

    status = MFRC522_Anticoll(&uid);
    if (status != MFRC522_OK) {
        qprint("ERROR: Anticollision failed\r\n");
        return;
    }

    status = MFRC522_SelectTag(&uid);
    if (status != MFRC522_OK) {
        qprint("ERROR: Card select failed\r\n");
        return;
    }

    // Authenticate
    status = MFRC522_Auth(PICC_CMD_MF_AUTH_KEY_A, blockAddr, keyA, &uid);
    if (status != MFRC522_OK) {
        qprint("ERROR: Authentication failed\r\n");
        MFRC522_Halt();
        return;
    }

    // Write block
    status = MFRC522_Write(blockAddr, data);
    if (status == MFRC522_OK) {
        qprint("SUCCESS: Block %d written\r\n", blockAddr);

        // Verify by reading back
        status = MFRC522_Read(blockAddr, readBuffer);
        if (status == MFRC522_OK) {
            qprint("Verify: ");
            for (uint8_t i = 0; i < 16; i++) {
                qprint("%02X ", readBuffer[i]);
            }
            qprint("\r\n");
        }
    } else {
        qprint("ERROR: Write failed\r\n");
    }

    MFRC522_Halt();
}

/**
 * @brief Print to A7 via Virtual UART
 */
void qprint(const char* format, ...) {
    OPENAMP_check_for_message();
    char buffer[256];
    va_list args;
    va_start(args, format);
    int len = vsnprintf(buffer, sizeof(buffer), format, args);
    va_end(args);

    if (len > 0) {
        VIRT_UART_Transmit(&huart0, (uint8_t*)buffer, len);
    }
}

/* USER CODE END 4 */

/* System configuration functions remain the same */
void SystemClock_Config(void)
{
  RCC_OscInitTypeDef RCC_OscInitStruct = {0};
  RCC_ClkInitTypeDef RCC_ClkInitStruct = {0};

  HAL_PWR_EnableBkUpAccess();
  __HAL_RCC_LSEDRIVE_CONFIG(RCC_LSEDRIVE_MEDIUMHIGH);

  RCC_OscInitStruct.OscillatorType = RCC_OSCILLATORTYPE_CSI|RCC_OSCILLATORTYPE_HSI
                              |RCC_OSCILLATORTYPE_HSE|RCC_OSCILLATORTYPE_LSE;
  RCC_OscInitStruct.HSEState = RCC_HSE_BYPASS_DIG;
  RCC_OscInitStruct.LSEState = RCC_LSE_ON;
  RCC_OscInitStruct.HSIState = RCC_HSI_ON;
  RCC_OscInitStruct.HSIDivValue = RCC_HSI_DIV1;
  RCC_OscInitStruct.CSIState = RCC_CSI_ON;
  RCC_OscInitStruct.PLL.PLLState = RCC_PLL_NONE;
  RCC_OscInitStruct.PLL2.PLLState = RCC_PLL_ON;
  RCC_OscInitStruct.PLL2.PLLSource = RCC_PLL12SOURCE_HSE;
  RCC_OscInitStruct.PLL2.PLLM = 3;
  RCC_OscInitStruct.PLL2.PLLN = 66;
  RCC_OscInitStruct.PLL2.PLLP = 2;
  RCC_OscInitStruct.PLL2.PLLQ = 1;
  RCC_OscInitStruct.PLL2.PLLR = 1;
  RCC_OscInitStruct.PLL2.PLLFRACV = 0x1400;
  RCC_OscInitStruct.PLL2.PLLMODE = RCC_PLL_FRACTIONAL;
  RCC_OscInitStruct.PLL3.PLLState = RCC_PLL_ON;
  RCC_OscInitStruct.PLL3.PLLSource = RCC_PLL3SOURCE_HSE;
  RCC_OscInitStruct.PLL3.PLLM = 2;
  RCC_OscInitStruct.PLL3.PLLN = 34;
  RCC_OscInitStruct.PLL3.PLLP = 2;
  RCC_OscInitStruct.PLL3.PLLQ = 17;
  RCC_OscInitStruct.PLL3.PLLR = 37;
  RCC_OscInitStruct.PLL3.PLLRGE = RCC_PLL3IFRANGE_1;
  RCC_OscInitStruct.PLL3.PLLFRACV = 6660;
  RCC_OscInitStruct.PLL3.PLLMODE = RCC_PLL_FRACTIONAL;
  RCC_OscInitStruct.PLL4.PLLState = RCC_PLL_ON;
  RCC_OscInitStruct.PLL4.PLLSource = RCC_PLL4SOURCE_HSE;
  RCC_OscInitStruct.PLL4.PLLM = 4;
  RCC_OscInitStruct.PLL4.PLLN = 99;
  RCC_OscInitStruct.PLL4.PLLP = 6;
  RCC_OscInitStruct.PLL4.PLLQ = 8;
  RCC_OscInitStruct.PLL4.PLLR = 8;
  RCC_OscInitStruct.PLL4.PLLRGE = RCC_PLL4IFRANGE_0;
  RCC_OscInitStruct.PLL4.PLLFRACV = 0;
  RCC_OscInitStruct.PLL4.PLLMODE = RCC_PLL_INTEGER;
  if (HAL_RCC_OscConfig(&RCC_OscInitStruct) != HAL_OK)
  {
    Error_Handler();
  }

  RCC_ClkInitStruct.ClockType = RCC_CLOCKTYPE_HCLK|RCC_CLOCKTYPE_ACLK
                              |RCC_CLOCKTYPE_PCLK1|RCC_CLOCKTYPE_PCLK2
                              |RCC_CLOCKTYPE_PCLK3|RCC_CLOCKTYPE_PCLK4
                              |RCC_CLOCKTYPE_PCLK5;
  RCC_ClkInitStruct.AXISSInit.AXI_Clock = RCC_AXISSOURCE_PLL2;
  RCC_ClkInitStruct.AXISSInit.AXI_Div = RCC_AXI_DIV1;
  RCC_ClkInitStruct.MCUInit.MCU_Clock = RCC_MCUSSOURCE_PLL3;
  RCC_ClkInitStruct.MCUInit.MCU_Div = RCC_MCU_DIV1;
  RCC_ClkInitStruct.APB4_Div = RCC_APB4_DIV2;
  RCC_ClkInitStruct.APB5_Div = RCC_APB5_DIV4;
  RCC_ClkInitStruct.APB1_Div = RCC_APB1_DIV2;
  RCC_ClkInitStruct.APB2_Div = RCC_APB2_DIV2;
  RCC_ClkInitStruct.APB3_Div = RCC_APB3_DIV2;

  if (HAL_RCC_ClockConfig(&RCC_ClkInitStruct) != HAL_OK)
  {
    Error_Handler();
  }

  __HAL_RCC_RTC_HSEDIV(24);
}

void PeriphCommonClock_Config(void)
{
  RCC_PeriphCLKInitTypeDef PeriphClkInit = {0};
  PeriphClkInit.PeriphClockSelection = RCC_PERIPHCLK_CKPER;
  PeriphClkInit.CkperClockSelection = RCC_CKPERCLKSOURCE_HSE;
  if (HAL_RCCEx_PeriphCLKConfig(&PeriphClkInit) != HAL_OK)
  {
    Error_Handler();
  }
}

static void MX_IPCC_Init(void)
{
  hipcc.Instance = IPCC;
  if (HAL_IPCC_Init(&hipcc) != HAL_OK)
  {
    Error_Handler();
  }
}

static void MX_SPI5_Init(void)
{
  hspi5.Instance = SPI5;
  hspi5.Init.Mode = SPI_MODE_MASTER;
  hspi5.Init.Direction = SPI_DIRECTION_2LINES;
  hspi5.Init.DataSize = SPI_DATASIZE_8BIT;
  hspi5.Init.CLKPolarity = SPI_POLARITY_LOW;
  hspi5.Init.CLKPhase = SPI_PHASE_1EDGE;
  hspi5.Init.NSS = SPI_NSS_SOFT;
  hspi5.Init.BaudRatePrescaler = SPI_BAUDRATEPRESCALER_8;
  hspi5.Init.FirstBit = SPI_FIRSTBIT_MSB;
  hspi5.Init.TIMode = SPI_TIMODE_DISABLE;
  hspi5.Init.CRCCalculation = SPI_CRCCALCULATION_DISABLE;
  hspi5.Init.CRCPolynomial = 0x0;
  hspi5.Init.NSSPMode = SPI_NSS_PULSE_ENABLE;
  hspi5.Init.NSSPolarity = SPI_NSS_POLARITY_LOW;
  hspi5.Init.FifoThreshold = SPI_FIFO_THRESHOLD_01DATA;
  hspi5.Init.TxCRCInitializationPattern = SPI_CRC_INITIALIZATION_ALL_ZERO_PATTERN;
  hspi5.Init.RxCRCInitializationPattern = SPI_CRC_INITIALIZATION_ALL_ZERO_PATTERN;
  hspi5.Init.MasterSSIdleness = SPI_MASTER_SS_IDLENESS_00CYCLE;
  hspi5.Init.MasterInterDataIdleness = SPI_MASTER_INTERDATA_IDLENESS_00CYCLE;
  hspi5.Init.MasterReceiverAutoSusp = SPI_MASTER_RX_AUTOSUSP_DISABLE;
  hspi5.Init.MasterKeepIOState = SPI_MASTER_KEEP_IO_STATE_DISABLE;
  hspi5.Init.IOSwap = SPI_IO_SWAP_DISABLE;
  if (HAL_SPI_Init(&hspi5) != HAL_OK)
  {
    Error_Handler();
  }
}

static void MX_DMA_Init(void)
{
  __HAL_RCC_DMAMUX_CLK_ENABLE();
  __HAL_RCC_DMA1_CLK_ENABLE();
}

static void MX_GPIO_Init(void)
{
  GPIO_InitTypeDef GPIO_InitStruct = {0};

  __HAL_RCC_GPIOD_CLK_ENABLE();
  __HAL_RCC_GPIOC_CLK_ENABLE();
  __HAL_RCC_GPIOH_CLK_ENABLE();
  __HAL_RCC_GPIOF_CLK_ENABLE();
  __HAL_RCC_GPIOA_CLK_ENABLE();

  HAL_GPIO_WritePin(GPIOD, RFID_RST_Pin|RFID_CS_Pin, GPIO_PIN_SET);

  GPIO_InitStruct.Pin = RFID_RST_Pin|RFID_CS_Pin;
  GPIO_InitStruct.Mode = GPIO_MODE_OUTPUT_PP;
  GPIO_InitStruct.Pull = GPIO_NOPULL;
  GPIO_InitStruct.Speed = GPIO_SPEED_FREQ_LOW;
  HAL_GPIO_Init(GPIOD, &GPIO_InitStruct);
}

void Error_Handler(void)
{
  __disable_irq();
  while (1)
  {
  }
}

#ifdef USE_FULL_ASSERT
void assert_failed(uint8_t *file, uint32_t line)
{
}
#endif
