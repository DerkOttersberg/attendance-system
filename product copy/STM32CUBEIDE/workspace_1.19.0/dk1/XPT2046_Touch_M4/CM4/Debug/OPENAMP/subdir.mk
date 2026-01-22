################################################################################
# Automatically-generated file. Do not edit!
# Toolchain: GNU Tools for STM32 (13.3.rel1)
################################################################################

# Add inputs and outputs from these tool invocations to the build variables 
C_SRCS += \
../OPENAMP/mbox_ipcc.c \
../OPENAMP/openamp.c \
../OPENAMP/openamp_log.c \
../OPENAMP/rsc_table.c 

OBJS += \
./OPENAMP/mbox_ipcc.o \
./OPENAMP/openamp.o \
./OPENAMP/openamp_log.o \
./OPENAMP/rsc_table.o 

C_DEPS += \
./OPENAMP/mbox_ipcc.d \
./OPENAMP/openamp.d \
./OPENAMP/openamp_log.d \
./OPENAMP/rsc_table.d 


# Each subdirectory must supply rules for building sources it contributes
OPENAMP/%.o OPENAMP/%.su OPENAMP/%.cyclo: ../OPENAMP/%.c OPENAMP/subdir.mk
	arm-none-eabi-gcc "$<" -mcpu=cortex-m4 -std=gnu11 -g3 -DDEBUG -DCORE_CM4 -DNO_ATOMIC_64_SUPPORT -DMETAL_INTERNAL -DMETAL_MAX_DEVICE_REGIONS=2 -DVIRTIO_SLAVE_ONLY -DUSE_HAL_DRIVER -DSTM32MP157Dxx -c -I../OPENAMP -I../Core/Inc -I../../Middlewares/Third_Party/OpenAMP/open-amp/lib/include -I../../Middlewares/Third_Party/OpenAMP/libmetal/lib/include -I../../Drivers/STM32MP1xx_HAL_Driver/Inc -I../../Drivers/STM32MP1xx_HAL_Driver/Inc/Legacy -I../../Drivers/CMSIS/Device/ST/STM32MP1xx/Include -I../../Middlewares/Third_Party/OpenAMP/virtual_driver -I../../Drivers/CMSIS/Include -O0 -ffunction-sections -fdata-sections -Wall -fstack-usage -fcyclomatic-complexity -MMD -MP -MF"$(@:%.o=%.d)" -MT"$@" --specs=nano.specs -mfpu=fpv4-sp-d16 -mfloat-abi=hard -mthumb -o "$@"

clean: clean-OPENAMP

clean-OPENAMP:
	-$(RM) ./OPENAMP/mbox_ipcc.cyclo ./OPENAMP/mbox_ipcc.d ./OPENAMP/mbox_ipcc.o ./OPENAMP/mbox_ipcc.su ./OPENAMP/openamp.cyclo ./OPENAMP/openamp.d ./OPENAMP/openamp.o ./OPENAMP/openamp.su ./OPENAMP/openamp_log.cyclo ./OPENAMP/openamp_log.d ./OPENAMP/openamp_log.o ./OPENAMP/openamp_log.su ./OPENAMP/rsc_table.cyclo ./OPENAMP/rsc_table.d ./OPENAMP/rsc_table.o ./OPENAMP/rsc_table.su

.PHONY: clean-OPENAMP

