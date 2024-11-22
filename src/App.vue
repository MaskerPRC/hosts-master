<template>
  <div id="app">
    <div class="title-bar">
      <div class="title">Hosts Master</div>
      <div class="window-controls">
        <div class="action-buttons">
          <button 
            class="action-btn import-btn" 
            @click="importData"
            title="导入方案"
          >
            <span class="icon">📥</span>
          </button>
          <div class="dropdown">
            <button 
              class="action-btn export-btn" 
              @click="showExportMenu"
              title="导出方案"
            >
              <span class="icon">📤</span>
            </button>
            <div class="dropdown-menu" v-if="showExportDropdown">
              <div 
                class="dropdown-item"
                @click="exportData('json')"
              >
                <span class="icon">📄</span>
                <span>导出为 JSON</span>
              </div>
              <div 
                class="dropdown-item"
                @click="exportData('excel')"
              >
                <span class="icon">📊</span>
                <span>导出为 Excel</span>
              </div>
              <div 
                class="dropdown-item"
                @click="exportData('csv')"
              >
                <span class="icon">📝</span>
                <span>导出为 CSV</span>
              </div>
            </div>
          </div>
          <button 
            class="action-btn clear-btn" 
            @click="showClearConfirm" 
            title="清除所有数据"
          >
            <span class="icon">🗑️</span>
          </button>
        </div>
        <div class="theme-selector">
          <button 
            class="theme-btn"
            @click="toggleThemeMenu"
            title="切换主题"
          >
            <span class="icon">🎨</span>
          </button>
          <div 
            v-show="showThemeMenu" 
            class="theme-menu"
          >
            <div
              v-for="theme in themes"
              :key="theme.id"
              class="theme-item"
              :class="{ active: currentTheme === theme.id }"
              @click="setTheme(theme.id)"
            >
              <span class="theme-color" :class="theme.id"></span>
              {{ theme.name }}
            </div>
          </div>
        </div>
        <div class="control">
          <button @click="minimize" class="control-button control-button-mini">
            <span class="icon">&#8211;</span>
          </button>
          <button @click="maximize" class="control-button control-button-max">
            <span class="icon">&#9633;</span>
          </button>
          <button @click="close" class="control-button control-button-close close">
            <span class="icon">&#10005;</span>
          </button>
        </div>
      </div>
    </div>
    <div class="main-content">
      <div
        :class="['left-panel', { 'collapsed': isLeftPanelCollapsed, 'resizing': isResizing }]"
        :style="{ width: leftPanelWidth + 'px' }"
      >
        <div class="resize-handle" @mousedown="startResize"></div>
        <button
          class="collapse-btn"
          @click="toggleLeftPanel"
          :title="isLeftPanelCollapsed ? '展开' : '收起'"
        >
          {{ isLeftPanelCollapsed ? '›' : '‹' }}
        </button>
        <space-selector
          @space-changed="onSpaceChanged"
        />
        <hosts-tree
          v-if="currentSpace"
          ref="hostsTree"
          @scheme-selected="onSchemeSelected"
          @data-cleared="onDataCleared"
        />
      </div>
      <div class="right-panel">
        <div class="editor-container">
          <hosts-editor
            v-model="hostsContent"
            :readonly="!canEdit"
            @input="startEditing"
            class="editor"
          />
          <version-panel
            :current-content="hostsContent"
            :space-id="currentSpaceId"
            @version-selected="onVersionSelected"
            @version-rollback="onVersionRollback"
            class="version-panel"
          />
        </div>
        <check-panel
          :active-schemes="activeSchemes"
          @status-updated="onHostStatusUpdated"
        />
        <button
          v-if="isEditing && canEdit"
          class="save-btn"
          @click="saveChanges"
        >保存</button>
      </div>
    </div>
  </div>
</template>

<script>
import HostsTree from '@/components/HostsTree';
import HostsEditor from '@/components/HostsEditor.vue';
import SpaceSelector from '@/components/SpaceSelector.vue';
import hostsService from '@/services/hosts';
import themeService from '@/services/theme';
import spaceService from '@/services/space';
import syntaxService from '@/services/syntax';
import CheckPanel from '@/components/CheckPanel.vue';
import VersionPanel from '@/components/VersionPanel.vue';

export default {
  name: 'App',
  components: {
    HostsTree,
    HostsEditor,
    SpaceSelector,
    CheckPanel,
    VersionPanel
  },
  data() {
    return {
      hostsContent: '',
      isEditing: false,
      canEdit: true,
      activeSchemes: [],
      currentScheme: null,
      leftPanelWidth: 280,
      isLeftPanelCollapsed: false,
      isResizing: false,
      showThemeMenu: false,
      themes: themeService.getThemes(),
      currentTheme: themeService.currentTheme,
      currentSpace: null,
      showExportDropdown: false
    };
  },
  computed: {
    editorPlaceholder() {
      if (this.activeSchemes.length === 0) {
        return '请选择一个方案';
      }
      if (!this.canEdit) {
        return '多个方案激活时不能编辑';
      }
      return '';
    },
    currentSpaceId() {
      return this.currentSpace?.id || '';
    }
  },
  async created() {
    try {
      // 初始化时读取系统 hosts 文件
      this.hostsContent = await hostsService.readSystemHosts();
      // 获取激活的方案
      const activeIds = await hostsService.getActiveSchemes();
      await this.updateActiveSchemes(activeIds);
      // 获取当前工作空间
      this.currentSpace = await spaceService.getCurrentSpace();
    } catch (error) {
      console.error('初始化失败:', error);
    }
  },
  methods: {
    startEditing() {
      if (this.canEdit && this.currentScheme) {
        this.isEditing = true;
      }
    },
    async saveChanges() {
      try {
        if (!this.canEdit || !this.currentScheme) {
          return;
        }

        // 验证内容
        const validation = syntaxService.validateContent(this.hostsContent);
        if (!validation.isValid) {
          const errorMessages = validation.errors
            .map(error => `第 ${error.line} 行: ${error.message}`)
            .join('\n');
          alert(`Hosts 文件包含以下错误:\n${errorMessages}`);
          return;
        }

        // 更新方案内容
        await hostsService.updateScheme(this.currentScheme.id, this.hostsContent);
        
        // 如果这个方案是激活的，要更新系统 hosts 文件
        const activeSchemes = await hostsService.getActiveSchemes();
        if (activeSchemes.includes(this.currentScheme.id)) {
          await hostsService.updateActiveSchemes(activeSchemes);
        }

        this.isEditing = false;
        await this.$refs.hostsTree?.loadData();
      } catch (error) {
        console.error('保存失败:', error);
        alert('保存失败: ' + error.message);
      }
    },
    async updateActiveSchemes(schemeIds) {
      try {
        const schemes = [];
        for (const id of schemeIds) {
          const scheme = await hostsService.findScheme(id);
          if (scheme) {
            schemes.push(scheme);
          }
        }

        // 检测激活方案之间的冲突
        if (schemes.length > 0) {
          const mergeResult = syntaxService.mergeAndValidate(schemes);
          if (mergeResult.hasConflicts) {
            const conflictMessages = mergeResult.conflicts
              .map(conflict => 
                `域名 "${conflict.domain}" 在多个方案中配置不一致:\n` +
                `  第 ${conflict.existingLine} 行: ${conflict.existingIp}\n` +
                `  第 ${conflict.currentLine} 行: ${conflict.currentIp}`
              )
              .join('\n\n');
            
            if (!confirm(`激活这些方案将导致以下域名冲突:\n\n${conflictMessages}\n\n是否仍要继续？`)) {
              // 恢复之前的选择状态
              this.$refs.hostsTree?.updateSelection(this.activeSchemes.map(s => s.id));
              return;
            }
          }

          this.activeSchemes = schemes;
          // 只有单个方案被选中时才允许编辑
          this.canEdit = schemes.length === 1;
          this.currentScheme = schemes.length === 1 ? schemes[0] : null;
          this.hostsContent = mergeResult.content;
        } else {
          // 没有方案被选中时，清空内容并设置为不可编辑
          this.activeSchemes = [];
          this.canEdit = false;
          this.currentScheme = null;
          this.hostsContent = '';
        }

        // 更新系统 hosts 文件
        await hostsService.updateActiveSchemes(schemeIds);
      } catch (error) {
        console.error('更新激活方案失败:', error);
      }
    },
    async removeScheme(schemeId) {
      const newSchemeIds = this.activeSchemes
        .filter(s => s.id !== schemeId)
        .map(s => s.id);
      await this.updateActiveSchemes(newSchemeIds);
      // 通知树形组件更新选中状态
      this.$refs.hostsTree.updateSelection(newSchemeIds);
    },
    minimize() {
      const { ipcRenderer } = window.require('electron');
      ipcRenderer.send('minimize-window');
    },
    maximize() {
      const { ipcRenderer } = window.require('electron');
      ipcRenderer.send('maximize-window');
    },
    close() {
      const { ipcRenderer } = window.require('electron');
      ipcRenderer.send('close-window');
    },
    async onSchemeSelected(scheme) {
      try {
        // 更新当前选中的方案
        this.currentScheme = scheme;
        // 更新编辑器内容
        this.hostsContent = scheme.content || '';
        // 设置为可编辑状态
        this.canEdit = true;
        this.isEditing = false;

        // 更新激活的方案
        await this.updateActiveSchemes([scheme.id]);
        // 通知树形组件更新选中状态
        this.$refs.hostsTree?.updateSelection([scheme.id]);
      } catch (error) {
        console.error('加载方案内容失败:', error);
        alert('加载方案内容失败: ' + error.message);
      }
    },
    async onDataCleared() {
      // 重置编辑器状态
      this.hostsContent = '';
      this.isEditing = false;
      this.canEdit = true;
      this.activeSchemes = [];
      this.currentScheme = null;
    },
    selectScheme(scheme) {
      this.currentScheme = scheme;
      this.hostsContent = scheme.content || '';
      this.canEdit = true;
      this.isEditing = false;
    },
    startResize(e) {
      this.isResizing = true;
      // 添加 resizing 类
      const leftPanel = e.target.parentElement;
      leftPanel.classList.add('resizing');

      const startX = e.clientX;
      const startWidth = this.leftPanelWidth;

      const doDrag = (e) => {
        if (!this.isResizing) return;
        const newWidth = startWidth + e.clientX - startX;
        this.leftPanelWidth = Math.max(200, Math.min(newWidth, 500));
      };

      const stopDrag = () => {
        this.isResizing = false;
        // 移除 resizing 类
        leftPanel.classList.remove('resizing');
        document.removeEventListener('mousemove', doDrag);
        document.removeEventListener('mouseup', stopDrag);
      };

      document.addEventListener('mousemove', doDrag);
      document.addEventListener('mouseup', stopDrag);
    },
    toggleLeftPanel() {
      this.isLeftPanelCollapsed = !this.isLeftPanelCollapsed;
    },
    toggleThemeMenu(event) {
      event.stopPropagation(); // 阻止事件冒泡
      this.showThemeMenu = !this.showThemeMenu;
    },
    setTheme(themeId) {
      themeService.setTheme(themeId);
      this.currentTheme = themeId;
      this.showThemeMenu = false; // 选择后关闭菜单
    },
    async onSpaceChanged(space) {
      this.currentSpace = space;
      // 重置编辑器状态
      this.hostsContent = '';
      this.isEditing = false;
      this.canEdit = false;
      this.currentScheme = null;
      this.activeSchemes = [];
      
      // 重新加载数据
      if (this.$refs.hostsTree) {
        await this.$refs.hostsTree.loadData();
      }
    },
    async importData() {
      try {
        const result = await hostsService.importData();
        if (result.success) {
          await this.$refs.hostsTree.loadData();
        }
      } catch (error) {
        console.error('导入失败:', error);
        alert('导入失败: ' + error.message);
      }
    },
    showExportMenu(event) {
      event.stopPropagation();
      this.showExportDropdown = true;
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
    async showClearConfirm() {
      if (confirm('确定要清除所有数据吗？这将会：\n1. 删除所有分组和方案\n2. 重置系统 hosts 文件\n此操作不可恢复！')) {
        try {
          await hostsService.clearData();
          await this.$refs.hostsTree.loadData();
          this.hostsContent = '';
          this.isEditing = false;
          this.canEdit = true;
          this.activeSchemes = [];
          this.currentScheme = null;
        } catch (error) {
          console.error('清除数据失败:', error);
          alert('清除数据失败: ' + error.message);
        }
      }
    },
    onHostStatusUpdated(statusMap) {
      // 更新树形组件中的状态显示
      if (this.$refs.hostsTree) {
        this.$refs.hostsTree.updateHostStatus(statusMap);
      }
    },
    // 处理版本选择
    onVersionSelected(content) {
      if (this.canEdit) {
        this.hostsContent = content;
        this.isEditing = true;
      }
    },
    // 处理版本回滚
    async onVersionRollback(content) {
      this.hostsContent = content;
      await this.saveChanges();
    }
  },
  mounted() {
    // 点击其他地方关闭主题菜单
    document.addEventListener('click', (e) => {
      if (!this.$el.querySelector('.theme-selector')?.contains(e.target)) {
        this.showThemeMenu = false;
      }
    });
  },
  beforeDestroy() {
    // 清理事件监听器
    document.removeEventListener('click', this.closeThemeMenu);
  }
};
</script>

<style>
/* 全局样式重置 */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  background: #000;
}

#app {
  height: 100vh;
  width: 100vw;
  display: flex;
  flex-direction: column;
  background-color: #1a1a1a;
  border: 1px solid #333;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
}

.title-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 16px;
  background-color: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
  -webkit-app-region: drag;
  height: 38px;
}

.title {
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text);
}

.window-controls {
  -webkit-app-region: no-drag;
  display: flex;
  gap: 4px;
}

.control-button {
  background: none;
  border: none;
  color: var(--color-text-secondary);
  font-size: 16px;
  padding: 4px 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  border-radius: 4px;
  height: 28px;
  width: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  -webkit-app-region: no-drag;
}

.control-button:hover {
  background-color: var(--color-hover);
  color: var(--color-text);
}

.control-button.close:hover {
  background-color: var(--color-error);
  color: white;
}

.main-content {
  display: flex;
  flex: 1;
  overflow: hidden;
  background-color: var(--color-background);
}

.left-panel {
  position: relative;
  border-right: 1px solid var(--color-border);
  background-color: var(--color-surface);
  overflow: hidden;
  transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.left-panel.collapsed {
  width: 40px !important;
  transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.left-panel.resizing {
  transition: none !important;
}

.resize-handle {
  position: absolute;
  right: -3px;
  top: 0;
  width: 6px;
  height: 100%;
  cursor: col-resize;
  z-index: 10;
}

.resize-handle:hover {
  background: var(--color-accent);
  opacity: 0.1;
}

.collapse-btn {
  position: absolute;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 20px;
  height: 60px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-right: none;
  color: var(--color-text-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  z-index: 5;
  border-top-left-radius: 4px;
  border-bottom-left-radius: 4px;
  transition: all 0.2s;
}

.collapse-btn:hover {
  background: var(--color-hover);
  color: var(--color-text);
}

.left-panel.collapsed .collapse-btn {
  border-right: 1px solid var(--color-border);
}

.right-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  background-color: var(--color-background);
  position: relative;
}

.editor-header {
  display: flex;
  align-items: center;
  padding: 0 16px;
  border-bottom: 1px solid #333;
  background-color: #252525;
  height: 40px;
  gap: 12px;
}

.active-schemes-tabs {
  flex: 1;
  display: flex;
  gap: 1px;
  overflow-x: auto;
  padding-bottom: 2px; /* 为滚动条留出空间 */
}

.scheme-tab {
  display: flex;
  align-items: center;
  padding: 0 12px;
  height: 32px;
  background: #2d2d2d;
  border-right: 1px solid #1a1a1a;
  cursor: pointer;
  min-width: 120px;
  max-width: 200px;
  transition: background-color 0.2s;
  margin-top: 8px;
  border-top-left-radius: 4px;
  border-top-right-radius: 4px;
  position: relative;
}

.scheme-tab:hover {
  background: #333;
}

.scheme-tab.active {
  background: #1a1a1a;
  border-bottom: 2px solid #007acc;
}

.tab-name {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: #ccc;
  font-size: 13px;
}

.scheme-tab.active .tab-name {
  color: #fff;
}

.tab-close {
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  color: #666;
  cursor: pointer;
  border-radius: 3px;
  margin-left: 4px;
  font-size: 16px;
  opacity: 0;
  transition: all 0.2s;
}

.scheme-tab:hover .tab-close {
  opacity: 1;
}

.tab-close:hover {
  background: #444;
  color: #fff;
}

.scheme-tab.active .tab-close {
  opacity: 1;
  color: #999;
}

/* 自定义滚动样式 */
.active-schemes-tabs::-webkit-scrollbar {
  height: 2px;
}

.active-schemes-tabs::-webkit-scrollbar-track {
  background: transparent;
}

.active-schemes-tabs::-webkit-scrollbar-thumb {
  background: #444;
  border-radius: 2px;
}

.active-schemes-tabs::-webkit-scrollbar-thumb:hover {
  background: #555;
}

.save-btn {
  position: absolute;
  right: 16px;
  bottom: 16px;
  padding: 8px 20px;
  background-color: var(--color-surface);
  color: var(--color-text);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 13px;
  z-index: 10;
}

.save-btn:hover {
  background-color: var(--color-hover);
  border-color: var(--color-border);
}

.hosts-editor {
  flex: 1;
  width: 100%;
  padding: 16px;
  border: none;
  resize: none;
  font-family: 'Courier New', Courier, monospace;
  font-size: 14px;
  line-height: 1.5;
  background-color: #1a1a1a;
  color: #fff;
  cursor: text;
}

.hosts-editor:focus {
  outline: none;
}

.hosts-editor[readonly] {
  cursor: not-allowed;
  opacity: 0.8;
}

/* 滚动条样式 */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: var(--color-surface);
}

::-webkit-scrollbar-thumb {
  background: var(--color-hover);
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: var(--color-text-secondary);
}

/* 选中文本的样式 */
::selection {
  background-color: var(--color-selection);
  color: var(--color-text);
}

/* 文本编辑器的行号效果 */
.hosts-editor {
  padding-left: 50px;
  background-image: linear-gradient(to right, #252525 40px, #1a1a1a 40px);
  background-size: 100% 100%;
  background-repeat: no-repeat;
  line-height: 1.6;
}
.control {
  -webkit-app-region: no-drag;
  display: flex;
}

.hosts-editor::placeholder {
  color: #666;
  font-style: italic;
}

/* 主题相关的 CSS 变量 */
:root {
  --color-background: #1a1a1a;
  --color-surface: #252525;
  --color-border: #333;
  --color-text: #fff;
  --color-text-secondary: #999;
  --color-accent: #007acc;
  --color-success: #4CAF50;
  --color-error: #ff6b6b;
  --color-hover: #333;
  --color-selection: #444;
}

/* 使用 CSS 变量替换原有的颜色值 */
#app {
  background-color: var(--color-background);
  color: var(--color-text);
}

/* ... 其他样式使用变量替换颜色值 ... */

.theme-selector {
  position: relative;
  margin-right: 8px;
}

.theme-btn {
  background: none;
  border: none;
  color: var(--color-text-secondary);
  padding: 4px 8px;
  cursor: pointer;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.theme-btn:hover {
  background-color: var(--color-hover);
}

.theme-menu {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 4px;
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  padding: 4px 0;
  min-width: 160px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  z-index: 1000;
}

.theme-item {
  padding: 8px 16px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--color-text);
  transition: all 0.2s;
}

.theme-item:hover {
  background-color: var(--color-hover);
}

.theme-item.active {
  color: var(--color-accent);
}

.theme-color {
  width: 16px;
  height: 16px;
  border-radius: 4px;
  border: 1px solid var(--color-border);
}

.theme-color.dark {
  background-color: #1a1a1a;
}

.theme-color.light {
  background-color: #ffffff;
}

.theme-color.pixel {
  background-color: #282828;
  border: 2px solid #00ff00;
}

.theme-color.zen {
  background-color: #fafafa;
  border: 1px solid #333333;
}

/* 像素风格特殊样式 */
.pixel {
  font-family: 'Press Start 2P', monospace;
  image-rendering: pixelated;
}

/* 极简风格特殊样式 */
.zen {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.left-panel {
  display: flex;
  flex-direction: column;
}

.action-buttons {
  display: flex;
  gap: 8px;
  margin-right: 16px;
}

.action-btn {
  background: none;
  border: none;
  color: var(--color-text-secondary);
  padding: 4px 8px;
  cursor: pointer;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.action-btn:hover {
  background-color: var(--color-hover);
  color: var(--color-text);
}

.action-btn.import-btn,
.action-btn.export-btn {
  color: var(--color-success);
}

.action-btn.clear-btn {
  color: var(--color-error);
}

.action-btn.clear-btn:hover {
  background-color: var(--color-hover);
  color: var(--color-error);
}

.window-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.right-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  background-color: var(--color-background);
  position: relative;
}

.editor-container {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.editor {
  flex: 1;
  min-width: 0; /* 防止编辑器被挤压 */
  border-right: 1px solid var(--color-border);
}

.version-panel {
  width: 300px; /* 固定宽度 */
  flex-shrink: 0; /* 防止被压缩 */
}
</style>
