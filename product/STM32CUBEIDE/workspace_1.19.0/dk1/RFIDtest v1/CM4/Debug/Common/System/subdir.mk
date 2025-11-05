################################################################################
# Automatically-generated file. Do not edit!
# Toolchain: GNU Tools for STM32 (13.3.rel1)
################################################################################

# Add inputs and outputs from these tool invocations to the build variables 
C_SRCS += \
C:/Users/derko/STM32CubeIDE/workspace_1.19.0/RFIDtest/Common/System/system_stm32mp1xx.c 

OBJS += \
./Common/System/system_stm32mp1xx.o 

C_DEPS += \
./Common/System/system_stm32mp1xx.d 


# Each subdirectory must supply rules for building sources it contributes
Common/System/system_stm32mp1xx.o: C:/Users/derko/STM32CubeIDE/workspace_1.19.0/RFIDtest/Common/System/system_stm32mp1xx.c Common/System/subdir.mk
	arm-none-eabi-gcc "$<" -mcpu=cortex-m4 -std=gnu11 -g3 -DDEBUG -DCORE_CM4 -DNO_ATOMIC_64_SUPPORT -DMETAL_INTERNAL -DMETAL_MAX_DEVICE_REGIONS=2 -DVIRTIO_SLAVE_ONLY -DUSE_HAL_DRIVER -DSTM32MP157Dxx -c -I../OPENAMP -I../Core/Inc -IC:/Users/derko/STM32Cube/Repository/STM32Cube_FW_MP1_V1.7.0/Middlewares/Third_Party/OpenAMP/open-amp/lib/include -IC:/Users/derko/STM32Cube/Repository/STM32Cube_FW_MP1_V1.7.0/Middlewares/Third_Party/OpenAMP/libmetal/lib/include -IC:/Users/derko/STM32Cube/Repository/STM32Cube_FW_MP1_V1.7.0/Drivers/STM32MP1xx_HAL_Driver/Inc -IC:/Users/derko/STM32Cube/Repository/STM32Cube_FW_MP1_V1.7.0/Drivers/STM32MP1xx_HAL_Driver/Inc/Legacy -IC:/Users/derko/STM32Cube/Repository/STM32Cube_FW_MP1_V1.7.0/Drivers/CMSIS/Device/ST/STM32MP1xx/Include -IC:/Users/derko/STM32Cube/Repository/STM32Cube_FW_MP1_V1.7.0/Middlewares/Third_Party/OpenAMP/virtual_driver -IC:/Users/derko/STM32Cube/Repository/STM32Cube_FW_MP1_V1.7.0/Drivers/CMSIS/Include -O0 -ffunction-sections -fdata-sections -Wall -fstack-usage -fcyclomatic-complexity -MMD -MP -MF"$(@:%.o=%.d)" -MT"$@" --specs=nano.specs -mfpu=fpv4-sp-d16 -mfloat-abi=hard -mthumb -o "$@"

clean: clean-Common-2f-System

clean-Common-2f-System:
	-$(RM) ./Common/System/system_stm32mp1xx.cyclo ./Common/System/system_stm32mp1xx.d ./Common/System/system_stm32mp1xx.o ./Common/System/system_stm32mp1xx.su

.PHONY: clean-Common-2f-System

