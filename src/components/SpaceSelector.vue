<template>
  <div class="space-selector">
    <div class="space-header" @click="toggleDropdown">
      <span class="space-name">{{ currentSpace?.name || '选择工作空间' }}</span>
      <span class="space-icon">▼</span>
    </div>
    
    <div v-if="showDropdown" class="space-dropdown">
      <div class="space-list">
        <div
          v-for="space in spaces"
          :key="space.id"
          :class="['space-item', { active: space.id === currentSpace?.id }]"
          @click="selectSpace(space)"
        >
          {{ space.name }}
        </div>
      </div>
      <div class="space-actions">
        <button class="space-action-btn" @click="showCreateDialog">
          <span class="icon">+</span> 新建工作空间
        </button>
      </div>
    </div>

    <!-- 创建工作空间对话框 -->
    <div v-if="showCreateSpace" class="dialog-overlay" @click.self="hideCreateDialog">
      <div class="dialog">
        <h3>新建工作空间</h3>
        <div class="dialog-content">
          <input 
            v-model="newSpaceName" 
            placeholder="请输入工作空间名称"
            class="dialog-input"
            @keyup.enter="createSpace"
          >
          <div class="dialog-buttons">
            <button class="cancel-btn" @click="hideCreateDialog">取消</button>
            <button 
              class="confirm-btn"
              @click="createSpace"
              :disabled="!newSpaceName"
            >确定</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import spaceService from '@/services/space';

export default {
  name: 'SpaceSelector',
  data() {
    return {
      spaces: [],
      currentSpace: null,
      showDropdown: false,
      showCreateSpace: false,
      newSpaceName: ''
    };
  },
  async created() {
    await this.loadSpaces();
  },
  methods: {
    async loadSpaces() {
      this.spaces = await spaceService.getAllSpaces();
      this.currentSpace = await spaceService.getCurrentSpace();
    },
    toggleDropdown() {
      this.showDropdown = !this.showDropdown;
    },
    async selectSpace(space) {
      try {
        await spaceService.switchSpace(space.id);
        this.currentSpace = space;
        this.showDropdown = false;
        this.$emit('space-changed', space);
      } catch (error) {
        console.error('切换工作空间失败:', error);
      }
    },
    showCreateDialog() {
      this.showCreateSpace = true;
      this.showDropdown = false;
      this.newSpaceName = '';
    },
    hideCreateDialog() {
      this.showCreateSpace = false;
      this.newSpaceName = '';
    },
    async createSpace() {
      if (!this.newSpaceName) return;

      try {
        const newSpace = await spaceService.createSpace(this.newSpaceName);
        await this.loadSpaces();
        await this.selectSpace(newSpace);
        this.hideCreateDialog();
      } catch (error) {
        console.error('创建工作空间失败:', error);
        alert('创建工作空间失败: ' + error.message);
      }
    }
  },
  mounted() {
    // 点击外部关闭下拉菜单
    document.addEventListener('click', (e) => {
      if (!this.$el.contains(e.target)) {
        this.showDropdown = false;
      }
    });
  },
  beforeDestroy() {
    document.removeEventListener('click', this.closeDropdown);
  }
};
</script>

<style scoped>
.space-selector {
  position: relative;
  width: 100%;
  border-bottom: 1px solid var(--color-border);
}

.space-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  cursor: pointer;
  user-select: none;
  transition: all 0.2s;
}

.space-header:hover {
  background-color: var(--color-hover);
}

.space-name {
  color: var(--color-text);
  font-weight: 500;
}

.space-icon {
  color: var(--color-text-secondary);
  font-size: 12px;
  transition: transform 0.2s;
}

.space-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  margin: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  z-index: 1000;
}

.space-list {
  max-height: 200px;
  overflow-y: auto;
}

.space-item {
  padding: 8px 16px;
  cursor: pointer;
  color: var(--color-text);
  transition: all 0.2s;
}

.space-item:hover {
  background-color: var(--color-hover);
}

.space-item.active {
  background-color: var(--color-selection);
  color: var(--color-text);
}

.space-actions {
  border-top: 1px solid var(--color-border);
  padding: 8px;
}

.space-action-btn {
  width: 100%;
  padding: 8px;
  background: none;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  color: var(--color-text);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition: all 0.2s;
}

.space-action-btn:hover {
  background-color: var(--color-hover);
}

.icon {
  font-size: 16px;
  color: var(--color-text-secondary);
}

/* 对话框样式 */
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
  width: 320px;
  overflow: hidden;
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
  padding: 16px;
}

.dialog-input {
  width: 100%;
  padding: 8px 12px;
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  color: var(--color-text);
  margin-bottom: 16px;
  font-size: 14px;
}

.dialog-buttons {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.dialog-buttons button {
  padding: 6px 16px;
  border-radius: 4px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}

.cancel-btn {
  background: transparent;
  border: 1px solid var(--color-border);
  color: var(--color-text-secondary);
}

.confirm-btn {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  color: var(--color-text);
}

.confirm-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style> 