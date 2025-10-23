################################################################################
# Automatically-generated file. Do not edit!
# Toolchain: GNU Tools for STM32 (13.3.rel1)
################################################################################

-include ../makefile.init

RM := rm -rf

# All of the sources participating in the build are defined here
-include sources.mk
-include OPENAMP/subdir.mk
-include Middlewares/Third_Party/OpenAMP/subdir.mk
-include Drivers/STM32MP1xx_HAL_Driver/subdir.mk
-include Core/Startup/subdir.mk
-include Core/Src/subdir.mk
-include Common/System/subdir.mk
-include objects.mk

ifneq ($(MAKECMDGOALS),clean)
ifneq ($(strip $(S_DEPS)),)
-include $(S_DEPS)
endif
ifneq ($(strip $(S_UPPER_DEPS)),)
-include $(S_UPPER_DEPS)
endif
ifneq ($(strip $(C_DEPS)),)
-include $(C_DEPS)
endif
endif

-include ../makefile.defs

OPTIONAL_TOOL_DEPS := \
$(wildcard ../makefile.defs) \
$(wildcard ../makefile.init) \
$(wildcard ../makefile.targets) \


BUILD_ARTIFACT_NAME := XPT2046_Touch_M4_CM4
BUILD_ARTIFACT_EXTENSION := elf
BUILD_ARTIFACT_PREFIX :=
BUILD_ARTIFACT := $(BUILD_ARTIFACT_PREFIX)$(BUILD_ARTIFACT_NAME)$(if $(BUILD_ARTIFACT_EXTENSION),.$(BUILD_ARTIFACT_EXTENSION),)

# Add inputs and outputs from these tool invocations to the build variables 
EXECUTABLES += \
XPT2046_Touch_M4_CM4.elf \

MAP_FILES += \
XPT2046_Touch_M4_CM4.map \

SIZE_OUTPUT += \
default.size.stdout \

OBJDUMP_LIST += \
XPT2046_Touch_M4_CM4.list \


# All Target
all: main-build

# Main-build Target
main-build: XPT2046_Touch_M4_CM4.elf secondary-outputs

# Tool invocations
XPT2046_Touch_M4_CM4.elf XPT2046_Touch_M4_CM4.map: $(OBJS) $(USER_OBJS) C:\Users\derko\STM32CubeIDE\workspace_1.19.0\XPT2046_Touch_M4\CM4\STM32MP157DACX_RAM.ld makefile objects.list $(OPTIONAL_TOOL_DEPS)
	arm-none-eabi-gcc -o "XPT2046_Touch_M4_CM4.elf" @"objects.list" $(USER_OBJS) $(LIBS) -mcpu=cortex-m4 -T"C:\Users\derko\STM32CubeIDE\workspace_1.19.0\XPT2046_Touch_M4\CM4\STM32MP157DACX_RAM.ld" --specs=nosys.specs -Wl,-Map="XPT2046_Touch_M4_CM4.map" -Wl,--gc-sections -static --specs=nano.specs -mfpu=fpv4-sp-d16 -mfloat-abi=hard -mthumb -Wl,--start-group -lc -lm -Wl,--end-group
	@echo 'Finished building target: $@'
	@echo ' '

default.size.stdout: $(EXECUTABLES) makefile objects.list $(OPTIONAL_TOOL_DEPS)
	arm-none-eabi-size  $(EXECUTABLES)
	@echo 'Finished building: $@'
	@echo ' '

XPT2046_Touch_M4_CM4.list: $(EXECUTABLES) makefile objects.list $(OPTIONAL_TOOL_DEPS)
	arm-none-eabi-objdump -h -S $(EXECUTABLES) > "XPT2046_Touch_M4_CM4.list"
	@echo 'Finished building: $@'
	@echo ' '

# Other Targets
clean:
	-$(RM) XPT2046_Touch_M4_CM4.elf XPT2046_Touch_M4_CM4.list XPT2046_Touch_M4_CM4.map default.size.stdout
	-@echo ' '

secondary-outputs: $(SIZE_OUTPUT) $(OBJDUMP_LIST)

fail-specified-linker-script-missing:
	@echo 'Error: Cannot find the specified linker script. Check the linker settings in the build configuration.'
	@exit 2

warn-no-linker-script-specified:
	@echo 'Warning: No linker script specified. Check the linker settings in the build configuration.'

.PHONY: all clean dependents main-build fail-specified-linker-script-missing warn-no-linker-script-specified

-include ../makefile.targets
