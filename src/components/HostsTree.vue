<template>
  <div class="hosts-tree">
    <div class="tree-groups">
      <div
        class="groups-header"
        :class="{
          'drag-over': isDragOver && canDrop,
          'drag-invalid': isDragOver && !canDrop
        }"
        @dragenter.prevent="onDragEnter"
        @dragover.prevent="onDragOver"
        @dragleave="onDragLeave"
        @drop.prevent="onDrop"
      >
        <h4>分组</h4>
        <button
          class="action-btn add-btn"
          @click="showAddDialog('group', 'root')"
          title="新建分组"
        >
          <span class="icon">📁</span>
        </button>
      </div>
      <div class="tree-content">
        <tree-item
          v-for="item in rootChildren"
          :key="item.id"
          :item="item"
          :active-schemes="activeSchemes"
          :selected-scheme="selectedSchemeId"
          :tree-data="treeData"
          @toggle-scheme="toggleScheme"
          @item-deleted="onItemDeleted"
          @item-renamed="onItemRenamed"
          @item-moved="onItemMoved"
          @scheme-selected="onSchemeSelected"
          @create-item="showAddDialog"
        />
      </div>
    </div>

    <!-- 添加对话框 -->
    <div v-if="showDialog" class="dialog-overlay" @click.self="hideDialog">
      <div class="dialog">
        <h3>{{ dialogTitle }}</h3>
        <div class="dialog-content">
          <input
            v-model="newItemName"
            :placeholder="dialogPlaceholder"
            @keyup.enter="createItem"
            ref="dialogInput"
            class="dialog-input"
          >
          <div class="dialog-buttons">
            <button class="cancel-btn" @click="hideDialog">取消</button>
            <button
              class="confirm-btn"
              @click="createItem"
              :disabled="!newItemName"
            >确定</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.header-buttons {
  display: flex;
  gap: 8px;
}

.action-btn {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  color: var(--color-text-secondary);
  width: 32px;
  height: 32px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.action-btn:hover {
  background: var(--color-hover);
  border-color: var(--color-border);
  color: var(--color-text);
}

.action-btn.add-btn {
  color: var(--color-success);
}

.action-btn.add-btn:hover {
  background: var(--color-hover);
  color: var(--color-success);
}

.action-btn.clear-btn {
  color: var(--color-error);
}

.action-btn.clear-btn:hover {
  background: var(--color-hover);
  color: var(--color-error);
}

.icon {
  font-size: 14px;
  line-height: 1;
}

.tree-content {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
  background-color: var(--color-background);
}

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

.dialog-input:focus {
  outline: none;
  border-color: var(--color-accent);
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

.cancel-btn:hover {
  background: var(--color-hover);
  color: var(--color-text);
}

.confirm-btn {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  color: var(--color-text);
}

.confirm-btn:hover:not(:disabled) {
  background: var(--color-hover);
}

.confirm-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.dropdown {
  position: relative;
}

.dropdown-menu {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 4px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  padding: 4px 0;
  min-width: 140px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  z-index: 1000;
}

.dropdown-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  color: var(--color-text);
  cursor: pointer;
  transition: all 0.2s;
}

.dropdown-item:hover {
  background: var(--color-hover);
  color: var(--color-text);
}

.dropdown-item .icon {
  font-size: 14px;
  width: 16px;
  text-align: center;
}

.action-btn {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  color: var(--color-text-secondary);
  width: 32px;
  height: 32px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.action-btn:hover {
  background: var(--color-hover);
  border-color: var(--color-border);
  color: var(--color-text);
}

.action-btn.add-btn {
  color: var(--color-success);
  font-size: 18px;
  font-weight: bold;
}

.action-btn.add-btn:hover {
  background: var(--color-hover);
  color: var(--color-success);
}

.action-btn.clear-btn {
  color: var(--color-error);
}

.action-btn.clear-btn:hover {
  background: var(--color-hover);
  color: var(--color-error);
}

.icon {
  font-size: 14px;
  line-height: 1;
}

.tree-groups {
  flex: 1;
  display: flex;
  flex-direction: column;
  border-top: 1px solid var(--color-border);
  margin-top: 8px;
}

.groups-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background-color: var(--color-surface);
  transition: all 0.2s;
  position: relative;
}

.groups-header.drag-over {
  background-color: var(--color-hover);
}

.groups-header.drag-invalid {
  background-color: var(--color-error);
  opacity: 0.1;
}

.groups-header.drag-over::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  border: 2px dashed var(--color-accent);
  pointer-events: none;
}

.groups-header.drag-invalid::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  border: 2px dashed var(--color-error);
  pointer-events: none;
}

.groups-header h4 {
  color: var(--color-text-secondary);
  font-size: 12px;
  font-weight: normal;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  flex: 1;
  cursor: default;
}

.tree-content {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.action-btn.import-btn,
.action-btn.export-btn {
  color: var(--color-success);
}

.action-btn.import-btn:hover,
.action-btn.export-btn:hover {
  background: var(--color-hover);
  color: var(--color-success);
}
</style>

<script>
import TreeItem from './TreeItem.vue';
const { ipcRenderer } = window.require('electron');
import hostsService from '@/services/hosts';

export default {
  name: 'HostsTree',
  components: {
    TreeItem
  },
  data() {
    return {
      treeData: [],
      activeSchemes: [],
      showDialog: false,
      dialogType: '',
      newItemName: '',
      selectedParentId: 'root',
      selectedSchemeId: '',
      currentParentId: null,
      showDropdown: false,
      isDragOver: false,
      dragEnterCount: 0,
      canDrop: false,
      lastValidatedId: null,
      showExportDropdown: false
    };
  },
  computed: {
    dialogTitle() {
      return this.dialogType === 'group' ? '新分组' : '新建方案';
    },
    dialogPlaceholder() {
      return this.dialogType === 'group' ? '请输入分组名称' : '请输入方案名称';
    },
    rootChildren() {
      return this.treeData.length > 0 ? this.treeData[0].children : [];
    }
  },
  created() {
    this.loadData();
  },
  beforeDestroy() {
    // 清理所有事件监听器
    this.$off();
  },
  methods: {
    async loadData() {
      try {
        console.log('正在获取最新数据...');
        const data = await ipcRenderer.invoke('hosts:get-all');
        console.log('获取到的数据:', data);
        this.treeData = data;
        this.activeSchemes = await ipcRenderer.invoke('hosts:get-active');
        console.log('数据载完成');
        ipcRenderer.send('hosts:data-changed');
      } catch (error) {
        console.error('加载数据失败:', error);
      }
    },

    async showClearConfirm() {
      if (confirm('确定要清除所有数据吗？这将会：\n1. 删除所有分组和方案\n2. 重置系统 hosts 文件\n此操作不可恢复！')) {
        try {
          await ipcRenderer.invoke('hosts:clear-data');
          await this.loadData();
          this.$emit('data-cleared');
        } catch (error) {
          console.error('清除数据失败:', error);
          alert('清除数据失败: ' + error.message);
        }
      }
    },

    async showAddDialog(type, parentId) {
      console.log('显示添加对话框:', type, parentId);
      this.dialogType = type;
      this.showDialog = true;
      this.newItemName = '';
      this.currentParentId = parentId;
      // 在下一个 tick 聚焦输入框
      this.$nextTick(() => {
        this.$refs.dialogInput?.focus();
      });
    },

    hideDialog() {
      this.showDialog = false;
      this.newItemName = '';
      this.currentParentId = null;
      this.dialogType = '';
    },

    onItemDeleted() {
      this.loadData();
    },

    onItemRenamed() {
      this.loadData();
    },

    onItemMoved() {
      console.log('开始重新加载数据...');
      this.loadData();
      console.log('数据重新加载完成');
    },

    onSchemeSelected(scheme) {
      this.selectedSchemeId = scheme.id;
      this.$emit('scheme-selected', scheme);
    },

    async createItem() {
      if (!this.newItemName) return;

      try {
        console.log('创建项目:', {
          type: this.dialogType,
          parentId: this.currentParentId,
          name: this.newItemName
        });

        if (this.dialogType === 'group') {
          await hostsService.createGroup(this.currentParentId, this.newItemName);
        } else {
          await hostsService.createScheme(this.currentParentId, this.newItemName, '');
        }

        await this.loadData();
        this.hideDialog();
      } catch (error) {
        console.error('创建失败:', error);
        alert('创建失败: ' + error.message);
      }
    },

    async toggleScheme(schemeId) {
      const index = this.activeSchemes.indexOf(schemeId);
      if (index === -1) {
        this.activeSchemes.push(schemeId);
      } else {
        this.activeSchemes.splice(index, 1);
      }

      try {
        await hostsService.updateActiveSchemes(this.activeSchemes);
      } catch (error) {
        console.error('更新激活方案失败:', error);
      }
    },

    updateSelection(schemeIds) {
      this.activeSchemes = schemeIds;
    },

    toggleDropdown() {
      this.showDropdown = !this.showDropdown;
    },

    hideDropdown() {
      this.showDropdown = false;
    },

    onDragEnter(event) {
      this.dragEnterCount++;
      if (this.dragEnterCount === 1) {
        this.isDragOver = true;
      }
    },

    async validateDrop(dragData) {
      if (!dragData) return false;

      try {
        // 使用服务层的验证方法
        const result = await hostsService.validateMove(dragData.id, 'root');
        return result.valid;
      } catch (error) {
        console.error('验证拖放失败:', error);
        return false;
      }
    },

    async onDragOver(event) {
      const dragData = window.__dragData;
      if (!dragData) return;

      // 先检查是否已经验证过
      if (this.lastValidatedId !== dragData.id) {
        this.canDrop = await this.validateDrop(dragData);
        this.lastValidatedId = dragData.id;
      }

      if (this.canDrop) {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
      } else {
        event.dataTransfer.dropEffect = 'none';
      }
    },

    onDragLeave() {
      this.dragEnterCount--;
      if (this.dragEnterCount === 0) {
        this.isDragOver = false;
      }
    },

    async onDrop(event) {
      event.preventDefault();
      this.isDragOver = false;
      this.dragEnterCount = 0;
      this.canDrop = false;
      this.lastValidatedId = null;

      const dragData = window.__dragData;
      if (!dragData) return;

      try {
        const result = await hostsService.moveItem(dragData.id, 'root');
        if (result.success) {
          await this.loadData();
        }
      } catch (error) {
        console.error('移动到根目录失败:', error);
      }
    },

    showExportMenu(event) {
      // 阻止事件冒泡，这样点击按钮时不会触发外部点击事件
      event.stopPropagation();
      this.showExportDropdown = true;
    },

    handleOutsideClick(event) {
      // 检查点击是否在下拉菜单外部
      const dropdown = this.$el.querySelector('.dropdown');
      if (dropdown && !dropdown.contains(event.target)) {
        this.showExportDropdown = false;
      }
    },

    async exportData(format) {
      try {
        const result = await hostsService.exportData([], format);
        if (result.success) {
          console.log(`导出 ${format} 成功`);
        }
      } catch (error) {
        console.error('导出失败:', error);
        alert('导出失败: ' + error.message);
      } finally {
        this.showExportDropdown = false;
      }
    },

    async importData() {
      try {
        const result = await hostsService.importData();
        if (result.success) {
          await this.loadData();
          console.log('导入成功');
        }
      } catch (error) {
        console.error('导入失败:', error);
        alert('导入失败: ' + error.message);
      }
    }
  },
  mounted() {
    // 点击其他地方时关闭下拉菜单
    document.addEventListener('click', this.handleOutsideClick);
  },
  beforeDestroy() {
    // 移除事件监听器
    document.removeEventListener('click', this.handleOutsideClick);
  }
};
</script>
