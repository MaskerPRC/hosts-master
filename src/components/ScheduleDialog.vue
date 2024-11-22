<template>
  <div class="dialog-overlay" @click.self="$emit('close')">
    <div class="dialog">
      <h3>定时任务设置</h3>
      <div class="dialog-content">
        <div class="input-group">
          <label>任务类型</label>
          <select v-model="scheduleType" class="dialog-input">
            <option value="activate">定时启用</option>
            <option value="deactivate">定时禁用</option>
            <option value="temporary">临时启用</option>
          </select>
        </div>

        <template v-if="scheduleType === 'temporary'">
          <div class="input-group">
            <label>持续时间</label>
            <div class="duration-input">
              <input 
                v-model.number="duration"
                type="number"
                min="1"
                class="dialog-input"
                placeholder="请输入数值"
              >
              <select v-model="durationUnit" class="dialog-input unit-select">
                <option value="minutes">分钟</option>
                <option value="hours">小时</option>
                <option value="days">天</option>
              </select>
            </div>
          </div>
        </template>

        <template v-else>
          <div class="input-group">
            <label>执行时间</label>
            <input 
              type="datetime-local"
              v-model="executeTime"
              class="dialog-input"
            >
          </div>
        </template>

        <div class="input-group">
          <label>重复</label>
          <select v-model="repeat" class="dialog-input">
            <option value="once">仅一次</option>
            <option value="daily">每天</option>
            <option value="weekly">每周</option>
            <option value="monthly">每月</option>
          </select>
        </div>

        <div class="dialog-buttons">
          <button class="cancel-btn" @click="$emit('close')">取消</button>
          <button 
            class="confirm-btn"
            @click="createSchedule"
            :disabled="!isValid"
          >确定</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import scheduleService from '@/services/schedule';

export default {
  name: 'ScheduleDialog',
  props: {
    item: {
      type: Object,
      required: true
    }
  },
  data() {
    return {
      scheduleType: 'activate',
      executeTime: '',
      duration: 1,
      durationUnit: 'hours',
      repeat: 'once'
    };
  },
  computed: {
    isValid() {
      if (this.scheduleType === 'temporary') {
        return this.duration > 0;
      }
      return !!this.executeTime;
    }
  },
  methods: {
    async createSchedule() {
      try {
        const config = {
          itemId: this.item.id,
          type: this.scheduleType,
          repeat: this.repeat
        };

        if (this.scheduleType === 'temporary') {
          // 计算持续时间（毫秒）
          let duration = this.duration;
          switch (this.durationUnit) {
            case 'minutes':
              duration *= 60 * 1000;
              break;
            case 'hours':
              duration *= 60 * 60 * 1000;
              break;
            case 'days':
              duration *= 24 * 60 * 60 * 1000;
              break;
          }
          config.duration = duration;
        } else {
          config.executeTime = new Date(this.executeTime).getTime();
        }

        await scheduleService.addSchedule(config);
        this.$emit('created');
        this.$emit('close');
      } catch (error) {
        console.error('创建定时任务失败:', error);
        alert('创建定时任务失败: ' + error.message);
      }
    }
  },
  created() {
    // 设置默认执行时间为当前时间后一小时
    const date = new Date();
    date.setHours(date.getHours() + 1);
    this.executeTime = date.toISOString().slice(0, 16);
  }
};
</script>

<style scoped>
.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.dialog {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  width: 400px;
  overflow: hidden;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
}

.dialog h3 {
  color: var(--color-text);
  font-size: 14px;
  font-weight: 500;
  padding: 16px;
  margin: 0;
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
}

.dialog-content {
  padding: 20px;
}

.input-group {
  margin-bottom: 20px;
}

.input-group:last-child {
  margin-bottom: 0;
}

.input-group label {
  display: block;
  color: var(--color-text-secondary);
  font-size: 12px;
  margin-bottom: 8px;
}

.dialog-input {
  width: 100%;
  padding: 8px 12px;
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  color: var(--color-text);
  font-size: 14px;
  transition: all 0.2s;
  height: 36px;
}

.dialog-input:focus {
  outline: none;
  border-color: var(--color-accent);
  box-shadow: 0 0 0 2px rgba(0, 122, 204, 0.1);
}

.dialog-input:hover {
  border-color: var(--color-text-secondary);
}

select.dialog-input {
  appearance: none;
  padding-right: 32px;
  background-image: url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23666' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 8px center;
  background-size: 16px;
  cursor: pointer;
}

.duration-input {
  display: flex;
  gap: 12px;
}

.duration-input .dialog-input {
  width: 120px;
}

.duration-input .unit-select {
  width: 100px;
}

input[type="datetime-local"].dialog-input {
  padding-right: 8px;
}

.dialog-buttons {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 24px;
  padding-top: 20px;
  border-top: 1px solid var(--color-border);
}

.dialog-buttons button {
  padding: 8px 20px;
  border-radius: 4px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
  height: 36px;
  min-width: 80px;
}

.cancel-btn {
  background: transparent;
  border: 1px solid var(--color-border);
  color: var(--color-text-secondary);
}

.cancel-btn:hover {
  background: var(--color-hover);
  border-color: var(--color-border);
  color: var(--color-text);
}

.confirm-btn {
  background: var(--color-accent);
  border: 1px solid var(--color-accent);
  color: white;
}

.confirm-btn:hover:not(:disabled) {
  background: var(--color-accent);
  filter: brightness(1.1);
}

.confirm-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 亮色主题特殊样式 */
:global(.light) .dialog {
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
}

:global(.light) .dialog-input {
  background: white;
}

:global(.light) .confirm-btn {
  background: var(--color-accent);
  color: white;
}

/* 像素风格特殊样式 */
:global(.pixel) .dialog-input {
  font-family: 'Press Start 2P', monospace;
  font-size: 12px;
  image-rendering: pixelated;
}

/* 极简风格特殊样式 */
:global(.zen) .dialog {
  border-radius: 0;
  box-shadow: none;
}

:global(.zen) .dialog-input {
  border-radius: 0;
}

:global(.zen) .dialog-buttons button {
  border-radius: 0;
}
</style> 