class VersionService {
  constructor() {
    this.ipcRenderer = window.require('electron').ipcRenderer;
  }

  async getVersions(spaceId) {
    try {
      return await this.ipcRenderer.invoke('version:get-all', { spaceId });
    } catch (error) {
      console.error('获取版本列表失败:', error);
      return [];
    }
  }

  async createVersion(spaceId, content) {
    try {
      return await this.ipcRenderer.invoke('version:create', { spaceId, content });
    } catch (error) {
      console.error('创建版本失败:', error);
      throw error;
    }
  }

  async rollbackVersion(spaceId, versionId) {
    try {
      return await this.ipcRenderer.invoke('version:rollback', { spaceId, versionId });
    } catch (error) {
      console.error('回滚版本失败:', error);
      throw error;
    }
  }
}

export default new VersionService(); 