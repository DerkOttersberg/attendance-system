/* USER CODE BEGIN Header */
/**
  ******************************************************************************
  * @file         stm32mp1xx_hal_msp.c
  * @brief        This file provides code for the MSP Initialization
  *               and de-Initialization codes.
  ******************************************************************************
  * @attention
  *
  * Copyright (c) 2025 STMicroelectronics.
  * All rights reserved.
  *
  * This software is licensed under terms that can be found in the LICENSE file
  * in the root directory of this software component.
  * If no LICENSE file comes with this software, it is provided AS-IS.
  *
  ******************************************************************************
  */
/* USER CODE END Header */

/* Includes ------------------------------------------------------------------*/
#include "main.h"
/* USER CODE BEGIN Includes */

/* USER CODE END Includes */

/* Private typedef -----------------------------------------------------------*/
/* USER CODE BEGIN TD */

/* USER CODE END TD */

/* Private define ------------------------------------------------------------*/
/* USER CODE BEGIN Define */

/* USER CODE END Define */

/* Private macro -------------------------------------------------------------*/
/* USER CODE BEGIN Macro */

/* USER CODE END Macro */

/* Private variables ---------------------------------------------------------*/
/* USER CODE BEGIN PV */

/* USER CODE END PV */

/* Private function prototypes -----------------------------------------------*/
/* USER CODE BEGIN PFP */

/* USER CODE END PFP */

/* External functions --------------------------------------------------------*/
/* USER CODE BEGIN ExternalFunctions */

/* USER CODE END ExternalFunctions */

/* USER CODE BEGIN 0 */

/* USER CODE END 0 */
/**
  * Initializes the Global MSP.
  */
void HAL_MspInit(void)
{

  /* USER CODE BEGIN MspInit 0 */

  /* USER CODE END MspInit 0 */

  __HAL_RCC_HSEM_CLK_ENABLE();

  /* System interrupt init*/
  /* MemoryManagement_IRQn interrupt configuration */
  HAL_NVIC_SetPriority(MemoryManagement_IRQn, 1, 0);
  /* BusFault_IRQn interrupt configuration */
  HAL_NVIC_SetPriority(BusFault_IRQn, 1, 0);
  /* UsageFault_IRQn interrupt configuration */
  HAL_NVIC_SetPriority(UsageFault_IRQn, 1, 0);
  /* SVCall_IRQn interrupt configuration */
  HAL_NVIC_SetPriority(SVCall_IRQn, 1, 0);
  /* DebugMonitor_IRQn interrupt configuration */
  HAL_NVIC_SetPriority(DebugMonitor_IRQn, 1, 0);
  /* PendSV_IRQn interrupt configuration */
  HAL_NVIC_SetPriority(PendSV_IRQn, 1, 0);

  /* Peripheral interrupt init */
  /* RCC_WAKEUP_IRQn interrupt configuration */
  HAL_NVIC_SetPriority(RCC_WAKEUP_IRQn, 0, 0);
  HAL_NVIC_EnableIRQ(RCC_WAKEUP_IRQn);

  /* USER CODE BEGIN MspInit 1 */

  /* USER CODE END MspInit 1 */
}

/**
  * @brief IPCC MSP Initialization
  * This function configures the hardware resources used in this example
  * @param hipcc: IPCC handle pointer
  * @retval None
  */
void HAL_IPCC_MspInit(IPCC_HandleTypeDef* hipcc)
{
  if(hipcc->Instance==IPCC)
  {
    /* USER CODE BEGIN IPCC_MspInit 0 */

    /* USER CODE END IPCC_MspInit 0 */
    /* Peripheral clock enable */
    __HAL_RCC_IPCC_CLK_ENABLE();
    /* IPCC interrupt Init */
    HAL_NVIC_SetPriority(IPCC_RX1_IRQn, 1, 0);
    HAL_NVIC_EnableIRQ(IPCC_RX1_IRQn);
    HAL_NVIC_SetPriority(IPCC_TX1_IRQn, 1, 0);
    HAL_NVIC_EnableIRQ(IPCC_TX1_IRQn);
    /* USER CODE BEGIN IPCC_MspInit 1 */

    /* USER CODE END IPCC_MspInit 1 */

  }

}

/**
  * @brief IPCC MSP De-Initialization
  * This function freeze the hardware resources used in this example
  * @param hipcc: IPCC handle pointer
  * @retval None
  */
void HAL_IPCC_MspDeInit(IPCC_HandleTypeDef* hipcc)
{
  if(hipcc->Instance==IPCC)
  {
    /* USER CODE BEGIN IPCC_MspDeInit 0 */

    /* USER CODE END IPCC_MspDeInit 0 */
    /* Peripheral clock disable */
    __HAL_RCC_IPCC_CLK_DISABLE();

    /* IPCC interrupt DeInit */
    HAL_NVIC_DisableIRQ(IPCC_RX1_IRQn);
    HAL_NVIC_DisableIRQ(IPCC_TX1_IRQn);
    /* USER CODE BEGIN IPCC_MspDeInit 1 */

    /* USER CODE END IPCC_MspDeInit 1 */
  }

}

/**
  * @brief SPI MSP Initialization
  * This function configures the hardware resources used in this example
  * @param hspi: SPI handle pointer
  * @retval None
  */
void HAL_SPI_MspInit(SPI_HandleTypeDef* hspi)
{
  GPIO_InitTypeDef GPIO_InitStruct = {0};
  RCC_PeriphCLKInitTypeDef PeriphClkInit = {0};
  if(hspi->Instance==SPI5)
  {
    /* USER CODE BEGIN SPI5_MspInit 0 */

    /* USER CODE END SPI5_MspInit 0 */
  if(IS_ENGINEERING_BOOT_MODE())
  {

  /** Initializes the peripherals clock
  */
    PeriphClkInit.PeriphClockSelection = RCC_PERIPHCLK_SPI45;
    PeriphClkInit.Spi45ClockSelection = RCC_SPI45CLKSOURCE_PCLK2;
    if (HAL_RCCEx_PeriphCLKConfig(&PeriphClkInit) != HAL_OK)
    {
      Error_Handler();
    }

  }

    /* Peripheral clock enable */
    __HAL_RCC_SPI5_CLK_ENABLE();

    __HAL_RCC_GPIOH_CLK_ENABLE();
    __HAL_RCC_GPIOF_CLK_ENABLE();
    /**SPI5 GPIO Configuration
    PH6     ------> SPI5_SCK
    PF9     ------> SPI5_MOSI
    PF8     ------> SPI5_MISO
    */
    GPIO_InitStruct.Pin = GPIO_PIN_6;
    GPIO_InitStruct.Mode = GPIO_MODE_AF_PP;
    GPIO_InitStruct.Pull = GPIO_NOPULL;
    GPIO_InitStruct.Speed = GPIO_SPEED_FREQ_MEDIUM;
    GPIO_InitStruct.Alternate = GPIO_AF5_SPI5;
    HAL_GPIO_Init(GPIOH, &GPIO_InitStruct);

    GPIO_InitStruct.Pin = GPIO_PIN_9|GPIO_PIN_8;
    GPIO_InitStruct.Mode = GPIO_MODE_AF_PP;
    GPIO_InitStruct.Pull = GPIO_NOPULL;
    GPIO_InitStruct.Speed = GPIO_SPEED_FREQ_MEDIUM;
    GPIO_InitStruct.Alternate = GPIO_AF5_SPI5;
    HAL_GPIO_Init(GPIOF, &GPIO_InitStruct);

    /* USER CODE BEGIN SPI5_MspInit 1 */

    /* USER CODE END SPI5_MspInit 1 */

  }

}

/**
  * @brief SPI MSP De-Initialization
  * This function freeze the hardware resources used in this example
  * @param hspi: SPI handle pointer
  * @retval None
  */
void HAL_SPI_MspDeInit(SPI_HandleTypeDef* hspi)
{
  if(hspi->Instance==SPI5)
  {
    /* USER CODE BEGIN SPI5_MspDeInit 0 */

    /* USER CODE END SPI5_MspDeInit 0 */
    /* Peripheral clock disable */
    __HAL_RCC_SPI5_CLK_DISABLE();

    /**SPI5 GPIO Configuration
    PH6     ------> SPI5_SCK
    PF9     ------> SPI5_MOSI
    PF8     ------> SPI5_MISO
    */
    HAL_GPIO_DeInit(GPIOH, GPIO_PIN_6);

    HAL_GPIO_DeInit(GPIOF, GPIO_PIN_9|GPIO_PIN_8);

    /* USER CODE BEGIN SPI5_MspDeInit 1 */

    /* USER CODE END SPI5_MspDeInit 1 */
  }

}

/* USER CODE BEGIN 1 */

/* USER CODE END 1 */
