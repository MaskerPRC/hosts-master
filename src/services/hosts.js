class HostsService {
  constructor() {
    this.ipcRenderer = window.require('electron').ipcRenderer;
  }

  async getAllGroups() {
    try {
      return await this.ipcRenderer.invoke('hosts:get-all');
    } catch (error) {
      console.error('获取所有分组失败:', error);
      return [];
    }
  }

  async getActiveSchemes() {
    try {
      return await this.ipcRenderer.invoke('hosts:get-active');
    } catch (error) {
      console.error('获取激活方案失败:', error);
      return [];
    }
  }

  async createGroup(parentId, name) {
    try {
      return await this.ipcRenderer.invoke('hosts:create-group', { parentId, name });
    } catch (error) {
      console.error('创建分组失败:', error);
      throw error;
    }
  }

  async createScheme(parentId, name, content = '') {
    try {
      return await this.ipcRenderer.invoke('hosts:create-scheme', { parentId, name, content });
    } catch (error) {
      console.error('创建方案失败:', error);
      throw error;
    }
  }

  async updateScheme(id, content) {
    try {
      return await this.ipcRenderer.invoke('hosts:update-scheme', { id, content });
    } catch (error) {
      console.error('更新方案失败:', error);
      throw error;
    }
  }

  async updateActiveSchemes(schemeIds) {
    try {
      return await this.ipcRenderer.invoke('hosts:update-active', schemeIds);
    } catch (error) {
      console.error('更新激活方案失败:', error);
      throw error;
    }
  }

  async readSystemHosts() {
    try {
      return await this.ipcRenderer.invoke('hosts:read');
    } catch (error) {
      console.error('读取系统 hosts 失败:', error);
      throw error;
    }
  }

  // 查找特定方案
  async findScheme(schemeId) {
    try {
      const groups = await this.getAllGroups();
      const findInGroups = (items) => {
        for (const item of items) {
          if (item.id === schemeId) return item;
          if (item.type === 'group' && item.children) {
            const found = findInGroups(item.children);
            if (found) return found;
          }
        }
        return null;
      };
      return findInGroups(groups);
    } catch (error) {
      console.error('查找方案失败:', error);
      return null;
    }
  }

  // 获取所有分组（不包括方案）
  async getAllGroupsOnly() {
    try {
      const groups = await this.getAllGroups();
      const collectGroups = (items) => {
        const result = [];
        items.forEach(item => {
          if (item.type === 'group') {
            result.push(item);
            if (item.children) {
              result.push(...collectGroups(item.children));
            }
          }
        });
        return result;
      };
      return collectGroups(groups);
    } catch (error) {
      console.error('获取分组列表失败:', error);
      return [];
    }
  }

  // 添加验证移动是否合法的方法
  async validateMove(itemId, targetGroupId) {
    try {
      return await this.ipcRenderer.invoke('hosts:validate-move', { itemId, targetGroupId });
    } catch (error) {
      return {
        valid: false,
        reason: error.message
      };
    }
  }

  async moveItem(itemId, targetGroupId) {
    // 先验证，再移动
    const validation = await this.validateMove(itemId, targetGroupId);
    if (!validation.valid) {
      throw new Error(validation.reason);
    }
    return await this.ipcRenderer.invoke('hosts:move-item', { itemId, targetGroupId });
  }

  async renameItem(itemId, newName) {
    try {
      return await this.ipcRenderer.invoke('hosts:rename-item', { itemId, newName });
    } catch (error) {
      console.error('重命名失败:', error);
      throw error;
    }
  }

  async deleteItem(itemId) {
    try {
      return await this.ipcRenderer.invoke('hosts:delete-item', { itemId });
    } catch (error) {
      console.error('删除项目失败:', error);
      throw error;
    }
  }

  async exportData(groupIds = [], format = 'json') {
    try {
      return await this.ipcRenderer.invoke('hosts:export', { groupIds, format });
    } catch (error) {
      console.error('导出失败:', error);
      throw error;
    }
  }

  async importData(parentId = 'root') {
    try {
      return await this.ipcRenderer.invoke('hosts:import', { parentId });
    } catch (error) {
      console.error('导入失败:', error);
      throw error;
    }
  }

  async createRemoteScheme(parentId, name, remoteUrl, syncInterval) {
    try {
      return await this.ipcRenderer.invoke('hosts:create-remote-scheme', {
        parentId,
        name,
        remoteUrl,
        syncInterval
      });
    } catch (error) {
      console.error('创建远程方案失败:', error);
      throw error;
    }
  }

  async syncRemoteScheme(schemeId) {
    try {
      return await this.ipcRenderer.invoke('hosts:sync-remote-scheme', { schemeId });
    } catch (error) {
      console.error('同步远程方案失败:', error);
      throw error;
    }
  }
}

export default new HostsService();
