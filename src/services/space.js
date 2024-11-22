class SpaceService {
  constructor() {
    this.ipcRenderer = window.require('electron').ipcRenderer;
  }

  async getAllSpaces() {
    try {
      return await this.ipcRenderer.invoke('space:get-all');
    } catch (error) {
      console.error('获取工作空间列表失败:', error);
      return [];
    }
  }

  async createSpace(name) {
    try {
      return await this.ipcRenderer.invoke('space:create', { name });
    } catch (error) {
      console.error('创建工作空间失败:', error);
      throw error;
    }
  }

  async switchSpace(spaceId) {
    try {
      return await this.ipcRenderer.invoke('space:switch', { spaceId });
    } catch (error) {
      console.error('切换工作空间失败:', error);
      throw error;
    }
  }

  async getCurrentSpace() {
    try {
      return await this.ipcRenderer.invoke('space:get-current');
    } catch (error) {
      console.error('获取当前工作空间失败:', error);
      return null;
    }
  }

  async renameSpace(spaceId, newName) {
    try {
      return await this.ipcRenderer.invoke('space:rename', { spaceId, newName });
    } catch (error) {
      console.error('重命名工作空间失败:', error);
      throw error;
    }
  }

  async deleteSpace(spaceId) {
    try {
      return await this.ipcRenderer.invoke('space:delete', { spaceId });
    } catch (error) {
      console.error('删除工作空间失败:', error);
      throw error;
    }
  }
}

export default new SpaceService(); 