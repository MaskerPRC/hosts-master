<template>
  <div class="tree-item-wrapper">
    <div 
      class="tree-item"
      :class="{ 
        'drag-over': isDragOver && canDrop,
        'drag-invalid': isDragOver && !canDrop 
      }"
    >
      <div 
        :class="[
          'item-header', 
          { 
            'is-group': item.type === 'group',
            'is-selected': isSelected,
            'dragging': isDragging
          }
        ]"
        draggable="true"
        @dragstart="onDragStart"
        @dragend="onDragEnd"
        @dragenter.prevent="onDragEnter"
        @dragover.prevent="onDragOver"
        @dragleave="onDragLeave"
        @drop.prevent="onDrop"
      >
        <span 
          v-if="item.type === 'group'" 
          class="expand-icon"
          @click.stop="toggleExpand"
        >
          <svg 
            class="arrow-icon"
            :class="{ expanded: expanded }"
            viewBox="0 0 24 24" 
            width="16" 
            height="16"
          >
            <path 
              d="M8.59 16.59L13.17 12L8.59 7.41L10 6l6 6l-6 6l-1.41-1.41z"
              fill="currentColor"
            />
          </svg>
        </span>
        <label 
          class="checkbox-wrapper"
          @click.stop
        >
          <input 
            type="checkbox"
            :checked="isActive"
            :indeterminate.prop="isIndeterminate"
            @change="toggleActive"
          >
          <span class="checkbox-custom"></span>
        </label>
        <span 
          class="item-name"
          @click.stop="onNameClick"
          @dblclick.stop="startEdit"
        >{{ item.name }}</span>
        <input
          v-if="isEditing"
          ref="nameInput"
          v-model="editName"
          class="name-input"
          @blur="finishEdit"
          @keyup.enter="finishEdit"
          @keyup.esc="cancelEdit"
        >
        <div class="item-actions" @click.stop>
          <template v-if="item.type === 'group'">
            <button 
              class="action-btn add-btn"
              @click.stop="$emit('create-item', 'group', item.id)"
              title="新建分组"
            >
              <span class="icon">📁</span>
            </button>
            <button 
              class="action-btn add-btn"
              @click.stop="$emit('create-item', 'scheme', item.id)"
              title="新建方案"
            >
              <span class="icon">📄</span>
            </button>
            <button 
              class="action-btn add-btn"
              @click.stop="showRemoteDialog"
              title="添加远程方案"
            >
              <span class="icon">🌐</span>
            </button>
          </template>
          <template v-else-if="item.isRemote">
            <button 
              class="action-btn sync-btn"
              @click="syncRemoteScheme"
              :title="'上次同步: ' + lastSyncTime"
            >
              <span class="icon">🔄</span>
            </button>
          </template>
          <button 
            class="action-btn edit-btn"
            @click="startEdit"
            title="重命名"
          >✎</button>
          <button 
            class="action-btn delete-btn"
            @click="deleteItem"
            title="删除"
          >×</button>
          <button 
            v-if="item.type === 'scheme'"
            class="action-btn schedule-btn"
            @click="showScheduleDialog"
            title="定时任务"
          >
            <span class="icon">⏰</span>
          </button>
        </div>
      </div>
      
      <div 
        v-if="item.type === 'group' && expanded" 
        class="group-children"
      >
        <tree-item
          v-for="child in item.children"
          :key="child.id"
          :item="child"
          :active-schemes="activeSchemes"
          :selected-scheme="selectedScheme"
          :tree-data="treeData"
          @toggle-scheme="$emit('toggle-scheme', $event)"
          @item-deleted="$emit('item-deleted')"
          @item-renamed="$emit('item-renamed')"
          @scheme-selected="$emit('scheme-selected', $event)"
          @item-moved="$emit('item-moved')"
          @create-item="onCreateItemChild"
        />
      </div>
    </div>

    <!-- 添加远程方案对话框 -->
    <div v-if="showRemoteSchemeDialog" class="dialog-overlay" @click.self="hideRemoteDialog">
      <div class="dialog">
        <h3>添加远程方案</h3>
        <div class="dialog-content">
          <div class="input-group">
            <label>方案名称</label>
            <input 
              v-model="remoteSchemeName" 
              placeholder="请输入方案名称"
              class="dialog-input"
            >
          </div>

          <div class="input-group">
            <label>同步类型</label>
            <select v-model="syncType" class="dialog-input">
              <option value="url">URL 直接同步</option>
              <option value="git">Git 仓库同步</option>
            </select>
          </div>

          <template v-if="syncType === 'url'">
            <div class="input-group">
              <label>远程地址</label>
              <input 
                v-model="remoteSchemeUrl" 
                placeholder="请输入远程 hosts 文件地址"
                class="dialog-input"
              >
            </div>
          </template>

          <template v-if="syncType === 'git'">
            <div class="input-group">
              <label>Git 仓库地址</label>
              <input 
                v-model="gitRepoUrl" 
                placeholder="例如: https://github.com/user/repo.git"
                class="dialog-input"
              >
            </div>
            <div class="input-group">
              <label>文件路径</label>
              <input 
                v-model="gitFilePath" 
                placeholder="仓库中的文件路径，例如: hosts/dev.hosts"
                class="dialog-input"
              >
            </div>
            <div class="input-group">
              <label>分支</label>
              <input 
                v-model="gitBranch" 
                placeholder="分支名称，默认: main"
                class="dialog-input"
              >
            </div>
            <div class="input-group">
              <label>访问令牌 (可选)</label>
              <input 
                v-model="gitToken" 
                type="password"
                placeholder="私有仓库需要提供访问令牌"
                class="dialog-input"
              >
            </div>
          </template>

          <div class="input-group">
            <label>同步间隔</label>
            <select v-model="syncInterval" class="dialog-input">
              <option value="3600000">每小时</option>
              <option value="14400000">每4小时</option>
              <option value="86400000">每天</option>
              <option value="604800000">每周</option>
            </select>
          </div>

          <div class="dialog-buttons">
            <button class="cancel-btn" @click="hideRemoteDialog">取消</button>
            <button 
              class="confirm-btn"
              @click="createRemoteScheme"
              :disabled="!isFormValid"
            >确定</button>
          </div>
        </div>
      </div>
    </div>

    <!-- 添加定时任务对话框 -->
    <schedule-dialog
      v-if="scheduleDialogVisible"
      :item="item"
      @close="hideScheduleDialog"
      @created="onScheduleCreated"
    />
  </div>
</template>

<script>
import hostsService from '@/services/hosts';
import ScheduleDialog from './ScheduleDialog.vue';

export default {
  name: 'TreeItem',
  props: {
    item: {
      type: Object,
      required: true
    },
    activeSchemes: {
      type: Array,
      default: () => []
    },
    selectedScheme: {
      type: String,
      default: ''
    },
    treeData: {
      type: Array,
      required: true
    }
  },
  data() {
    return {
      expanded: false,
      isEditing: false,
      editName: '',
      isDragOver: false,
      isDragging: false,
      dragEnterCount: 0,
      dragData: null,
      canDrop: false,
      showRemoteSchemeDialog: false,
      remoteSchemeName: '',
      remoteSchemeUrl: '',
      syncInterval: 3600000,
      syncType: 'url',
      gitRepoUrl: '',
      gitFilePath: '',
      gitBranch: 'main',
      gitToken: '',
      scheduleDialogVisible: false
    };
  },
  computed: {
    isActive() {
      if (this.item.type === 'scheme') {
        return this.activeSchemes.includes(this.item.id);
      } else if (this.item.type === 'group') {
        const schemes = this.getAllSchemes(this.item);
        return schemes.length > 0 && schemes.every(id => this.activeSchemes.includes(id));
      }
      return false;
    },
    isIndeterminate() {
      if (this.item.type !== 'group') return false;
      
      const schemes = this.getAllSchemes(this.item);
      if (schemes.length === 0) return false;
      
      const activeCount = schemes.filter(id => this.activeSchemes.includes(id)).length;
      return activeCount > 0 && activeCount < schemes.length;
    },
    isSelected() {
      return this.item.type === 'scheme' && this.selectedScheme === this.item.id;
    },
    lastSyncTime() {
      if (!this.item.lastSync) return '从未同步';
      return new Date(this.item.lastSync).toLocaleString();
    },
    isFormValid() {
      if (!this.remoteSchemeName) return false;

      if (this.syncType === 'url') {
        return !!this.remoteSchemeUrl;
      } else {
        return !!this.gitRepoUrl && !!this.gitFilePath;
      }
    }
  },
  methods: {
    onNameClick() {
      if (this.item.type === 'group') {
        this.toggleExpand();
      }
    },
    toggleExpand() {
      if (this.item.type === 'group') {
        this.expanded = !this.expanded;
      }
    },
    startEdit() {
      this.isEditing = true;
      this.editName = this.item.name;
      this.$nextTick(() => {
        this.$refs.nameInput?.focus();
      });
    },
    async finishEdit() {
      if (!this.isEditing) return;
      
      try {
        if (this.editName && this.editName !== this.item.name) {
          await hostsService.renameItem(this.item.id, this.editName);
          this.$emit('item-renamed');
        }
      } catch (error) {
        console.error('重命名失败:', error);
        alert('重命名失败: ' + error.message);
      }
      
      this.isEditing = false;
    },
    cancelEdit() {
      this.isEditing = false;
    },
    async deleteItem() {
      if (!confirm(`确定删除${this.item.type === 'group' ? '分组' : '方案'} "${this.item.name}" 吗？`)) {
        return;
      }

      try {
        await hostsService.deleteItem(this.item.id);
        this.$emit('item-deleted');
      } catch (error) {
        console.error('删除失败:', error);
        alert('删除失败: ' + error.message);
      }
    },
    onDragStart(event) {
      this.isDragging = true;
      const data = {
        id: this.item.id,
        type: this.item.type,
        name: this.item.name
      };
      window.__dragData = data;
      event.dataTransfer.setData('text/plain', JSON.stringify(data));
      event.target.style.opacity = '0.4';
      event.dataTransfer.effectAllowed = 'move';
    },

    onDragEnd() {
      window.__dragData = null;
      this.isDragging = false;
      this.isDragOver = false;
      event.target.style.opacity = '1';
    },

    onDragEnter(event) {
      if (this.item.type !== 'group') return;
      this.dragEnterCount++;
      if (this.dragEnterCount === 1) {
        this.isDragOver = true;
      }
    },

    async validateDrop(dragData) {
      if (!dragData) return false;
      if (this.item.type !== 'group') return false;

      const result = await hostsService.validateMove(dragData.id, this.item.id);
      return result.valid;
    },

    onDragOver(event) {
      const dragData = window.__dragData;
      if (!dragData) return;

      this.validateDrop(dragData).then(isValid => {
        this.canDrop = isValid;
        if (isValid) {
          event.preventDefault();
          event.dataTransfer.dropEffect = 'move';
        } else {
          event.dataTransfer.dropEffect = 'none';
        }
      });
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

      const dragData = window.__dragData;
      if (!dragData) return;

      try {
        await hostsService.moveItem(dragData.id, this.item.id);
        this.$emit('item-moved');
      } catch (error) {
        // 错误已经在服务层处理，这里不需要额外提示
        console.error('移动失败:', error);
      }

      window.__dragData = null;
      this.isDragging = false;
      event.target.style.opacity = '1';
    },

    isDescendantOf(parentId) {
      const findInChildren = (items, targetId) => {
        for (const item of items) {
          if (item.id === targetId) return true;
          if (item.type === 'group' && item.children) {
            if (findInChildren(item.children, targetId)) return true;
          }
        }
        return false;
      };

      return findInChildren([{ id: parentId, type: 'group', children: this.item.children }], this.item.id);
    },

    // 获取项目的完整路径
    async getItemPath(itemId) {
      const path = [];
      const findPath = (items, id, currentPath = []) => {
        for (const item of items) {
          const newPath = [...currentPath, item];
          if (item.id === id) {
            path.push(...newPath);
            return true;
          }
          if (item.type === 'group' && item.children) {
            if (findPath(item.children, id, newPath)) {
              return true;
            }
          }
        }
        return false;
      };

      const groups = await hostsService.getAllGroups();
      findPath(groups, itemId);
      return path;
    },

    // 检查移动是否会导致循环引用
    async checkCircularReference(sourceId, targetId) {
      // 获取源项目和目标项目的路径
      const sourcePath = await this.getItemPath(sourceId);
      const targetPath = await this.getItemPath(targetId);

      // 如果源项目是目标项目的祖先，则不允许移动
      if (targetPath.some(item => item.id === sourceId)) {
        return true;
      }

      return false;
    },

    // 改事件处理法
    onCreateItemChild(type, parentId) {
      // 正确传递事件参数
      this.$emit('create-item', type, parentId);
    },

    // 获取分组下所有方案的 ID
    getAllSchemes(item) {
      const schemes = [];
      const collect = (node) => {
        if (node.type === 'scheme') {
          schemes.push(node.id);
        } else if (node.type === 'group' && node.children) {
          node.children.forEach(collect);
        }
      };
      collect(item);
      return schemes;
    },

    // 切换激活状态
    toggleActive() {
      if (this.item.type === 'scheme') {
        this.$emit('toggle-scheme', this.item.id);
      } else if (this.item.type === 'group') {
        // 获取所有子方案
        const schemes = this.getAllSchemes(this.item);
        if (this.isActive) {
          // 如果全部选中，则取消所有
          schemes.forEach(id => this.$emit('toggle-scheme', id));
        } else {
          // 否则选中所有未选中的
          schemes
            .filter(id => !this.activeSchemes.includes(id))
            .forEach(id => this.$emit('toggle-scheme', id));
        }
      }
    },

    showRemoteDialog() {
      this.showRemoteSchemeDialog = true;
      this.remoteSchemeName = '';
      this.syncType = 'url';
      this.remoteSchemeUrl = '';
      this.gitRepoUrl = '';
      this.gitFilePath = '';
      this.gitBranch = 'main';
      this.gitToken = '';
      this.syncInterval = 3600000;
    },

    hideRemoteDialog() {
      this.showRemoteSchemeDialog = false;
    },

    async createRemoteScheme() {
      try {
        const config = {
          parentId: this.item.id,
          name: this.remoteSchemeName,
          syncInterval: this.syncInterval,
          syncType: this.syncType
        };

        if (this.syncType === 'url') {
          config.remoteUrl = this.remoteSchemeUrl;
        } else {
          config.git = {
            repoUrl: this.gitRepoUrl,
            filePath: this.gitFilePath,
            branch: this.gitBranch || 'main',
            token: this.gitToken
          };
        }

        await hostsService.createRemoteScheme(config);
        this.$emit('item-created');
        this.hideRemoteDialog();
      } catch (error) {
        console.error('创建远程方案失败:', error);
        alert('创建远程方案失败: ' + error.message);
      }
    },

    async syncRemoteScheme() {
      try {
        await hostsService.syncRemoteScheme(this.item.id);
        this.$emit('item-updated');
      } catch (error) {
        console.error('同步远程方案失败:', error);
        alert('同步远程方案失败: ' + error.message);
      }
    },

    showScheduleDialog() {
      this.scheduleDialogVisible = true;
    },
    hideScheduleDialog() {
      this.scheduleDialogVisible = false;
    },
    onScheduleCreated() {
      this.scheduleDialogVisible = false;
      // 可以在这里添加一些反馈
    }
  },
  components: {
    ScheduleDialog
  }
};
</script>

<style scoped>
.tree-item-wrapper {
  position: relative;
}

.tree-item {
  margin-bottom: 2px;
}

.item-header {
  display: flex;
  align-items: center;
  padding: 8px;
  border-radius: 4px;
  cursor: pointer;
  color: #ccc;
  transition: all 0.2s;
  position: relative;
}

.item-header:hover {
  background: #333;
}

.item-header.is-group {
  font-weight: 500;
  color: #fff;
}

.expand-icon {
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 8px;
  color: #666;
  transition: all 0.2s;
}

.arrow-icon {
  transition: transform 0.2s ease;
  transform: rotate(0deg);
}

.arrow-icon.expanded {
  transform: rotate(90deg);
}

.item-header:hover .expand-icon {
  color: #999;
}

.item-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.group-children {
  margin-left: 24px;
  margin-top: 2px;
}

.item-actions {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  display: none;
  gap: 4px;
}

.item-header:hover .item-actions {
  display: flex;
}

.action-btn {
  background: none;
  border: none;
  color: #666;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 3px;
  transition: all 0.2s;
}

.action-btn:hover {
  background: #333;
  color: #fff;
}

.delete-btn:hover {
  background: #e81123;
}

.name-input {
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  background: #1a1a1a;
  border: 1px solid #444;
  border-radius: 4px;
  color: #fff;
  padding: 0 8px;
}

.name-input:focus {
  outline: none;
  border-color: #666;
}

.item-header.is-selected {
  background: #2c3e50;
}

.checkbox-wrapper {
  position: relative;
  display: inline-block;
  margin-right: 8px;
  width: 16px;
  height: 16px;
  cursor: pointer;
}

.checkbox-wrapper input {
  position: absolute;
  opacity: 0;
  cursor: pointer;
  height: 0;
  width: 0;
}

.checkbox-custom {
  position: absolute;
  top: 0;
  left: 0;
  height: 16px;
  width: 16px;
  background-color: #1a1a1a;
  border: 1px solid #444;
  border-radius: 3px;
  transition: all 0.2s;
}

.checkbox-wrapper:hover .checkbox-custom {
  border-color: #666;
}

.checkbox-wrapper input:checked ~ .checkbox-custom {
  background-color: #007acc;
  border-color: #007acc;
}

.checkbox-custom:after {
  content: "";
  position: absolute;
  display: none;
  left: 5px;
  top: 2px;
  width: 4px;
  height: 8px;
  border: solid white;
  border-width: 0 2px 2px 0;
  transform: rotate(45deg);
}

.checkbox-wrapper input:checked ~ .checkbox-custom:after {
  display: block;
}

.item-header:hover:not(.is-selected) {
  background: #333;
}

.item-header.is-selected:hover {
  background: #34495e;
}

.drag-over > .item-header {
  background-color: #2c3e50;
  border: 2px dashed #007acc;
}

.drag-invalid > .item-header {
  background-color: #4e2c2c;
  border: 2px dashed #e81123;
}

.tree-item.drag-over::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 122, 204, 0.1);
  border-radius: 4px;
  pointer-events: none;
}

.tree-item.drag-invalid::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(232, 17, 35, 0.1);
  border-radius: 4px;
  pointer-events: none;
}

.dragging {
  opacity: 0.4;
}

.item-header {
  user-select: none;
  cursor: grab;
}

.item-header:active {
  cursor: grabbing;
}

.tree-item.drag-over {
  position: relative;
}

.tree-item.drag-over::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 122, 204, 0.1);
  border-radius: 4px;
  pointer-events: none;
}

/* 添加禁止拖放的视觉反馈 */
.tree-item.invalid-drop {
  position: relative;
}

.tree-item.invalid-drop::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(232, 17, 35, 0.1);
  border: 2px dashed #e81123;
  border-radius: 4px;
  pointer-events: none;
}

.action-btn.add-btn {
  color: #4CAF50;
}

.action-btn.add-btn:hover {
  background: #1a3a1c;
  color: #4CAF50;
}

.icon {
  font-size: 12px;
  line-height: 1;
}

/* 添加半选中状态的样式 */
.checkbox-wrapper input:indeterminate ~ .checkbox-custom {
  background-color: #666;
  border-color: #666;
}

.checkbox-wrapper input:indeterminate ~ .checkbox-custom:after {
  content: "";
  position: absolute;
  display: block;
  left: 3px;
  top: 7px;
  width: 8px;
  height: 2px;
  background: white;
}

.sync-btn {
  color: #4CAF50;
}

.sync-btn:hover {
  background: #1a3a1c;
  color: #4CAF50;
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
  background: #252525;
  border: 1px solid #444;
  border-radius: 8px;
  width: 400px;
  overflow: hidden;
}

.dialog h3 {
  color: #fff;
  font-size: 14px;
  font-weight: 500;
  padding: 16px;
  margin: 0;
  background: #2d2d2d;
  border-bottom: 1px solid #333;
}

.dialog-content {
  padding: 16px;
}

.input-group {
  margin-bottom: 16px;
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
}

.dialog-input:focus {
  outline: none;
  border-color: var(--color-accent);
}

select.dialog-input {
  appearance: none;
  padding-right: 24px;
  background-image: url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23666' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 8px center;
  background-size: 16px;
  cursor: pointer;
}

select.dialog-input:hover {
  border-color: #555;
}

.dialog-buttons {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 24px;
}

.dialog-buttons button {
  padding: 8px 20px;
  border-radius: 4px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}

.cancel-btn {
  background: transparent;
  border: 1px solid #444;
  color: #ccc;
}

.cancel-btn:hover {
  background: #333;
  border-color: #555;
  color: #fff;
}

.confirm-btn {
  background: #2d2d2d;
  border: 1px solid #444;
  color: #fff;
}

.confirm-btn:hover:not(:disabled) {
  background: #444;
  border-color: #555;
}

.confirm-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 亮色主题特殊样式 */
:global(.light) .tree-item {
  border-bottom: 1px solid var(--color-border);
}

:global(.light) .item-header {
  color: var(--color-text);
  background: var(--color-surface);
  margin: 1px 0;
}

:global(.light) .item-header:hover {
  background: #f5f5f5;
  color: var(--color-text);
}

:global(.light) .item-header.is-group {
  font-weight: 600;
  color: var(--color-text);
}

:global(.light) .expand-icon {
  color: var(--color-text-secondary);
}

:global(.light) .item-header:hover .expand-icon {
  color: var(--color-text);
}

:global(.light) .item-actions {
  background: transparent;
}

:global(.light) .action-btn {
  color: var(--color-text-secondary);
  background: transparent;
}

:global(.light) .action-btn:hover {
  background: #f0f0f0;
  color: var(--color-text);
}

:global(.light) .action-btn.add-btn {
  color: var(--color-success);
}

:global(.light) .action-btn.add-btn:hover {
  background: #e8f5e9;
  color: var(--color-success);
}

:global(.light) .action-btn.delete-btn:hover {
  background: #ffebee;
  color: var(--color-error);
}

:global(.light) .checkbox-custom {
  background-color: #fff;
  border: 1px solid var(--color-border);
}

:global(.light) .checkbox-wrapper:hover .checkbox-custom {
  border-color: var(--color-text-secondary);
}

:global(.light) .checkbox-wrapper input:checked ~ .checkbox-custom {
  background-color: var(--color-accent);
  border-color: var(--color-accent);
}

:global(.light) .item-header.is-selected {
  background: #e3f2fd;
}

:global(.light) .item-header.is-selected:hover {
  background: #bbdefb;
}

:global(.light) .drag-over > .item-header {
  background-color: #e3f2fd;
  border: 2px dashed var(--color-accent);
}

:global(.light) .drag-invalid > .item-header {
  background-color: #ffebee;
  border: 2px dashed var(--color-error);
}

:global(.light) .group-children {
  border-left: 1px solid var(--color-border);
  margin-left: 12px;
  padding-left: 12px;
}

/* 修改原有的暗色主题样式，确保兼容性 */
.tree-item {
  margin-bottom: 0;
  position: relative;
}

.item-header {
  display: flex;
  align-items: center;
  padding: 8px;
  border-radius: 0;
  cursor: pointer;
  transition: all 0.2s;
  position: relative;
}

.group-children {
  margin-left: 12px;
  padding-left: 12px;
}

.schedule-btn {
  color: #ffd700;
}

.schedule-btn:hover {
  background: #332b00;
  color: #ffd700;
}
</style> 