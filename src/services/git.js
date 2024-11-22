class GitService {
  constructor() {
    // 工作目录将由主进程管理
    this.initialized = false;
    this.ipcRenderer = window.require('electron').ipcRenderer;
  }

  async init() {
    if (!this.initialized) {
      try {
        await this.ipcRenderer.invoke('git:init');
        this.initialized = true;
      } catch (error) {
        console.error('初始化失败:', error);
        throw error;
      }
    }
  }

  async getBranches() {
    try {
      await this.init();
      // 通过 IPC 获取分支列表
      const branches = await this.ipcRenderer.invoke('git:get-branches');
      return branches;
    } catch (error) {
      console.error('获取分支列表失败:', error);
      return [];
    }
  }

  async checkout(branchName) {
    if (!branchName) {
      throw new Error('分支名称不能为空');
    }

    try {
      await this.init();
      return await this.ipcRenderer.invoke('git:checkout-branch', branchName);
    } catch (error) {
      console.error('切换分支失败:', error);
      throw error;
    }
  }

  async checkoutCommit(hash) {
    if (!hash) {
      throw new Error('提交哈希不能为空');
    }

    try {
      await this.init();
      return await this.ipcRenderer.invoke('git:checkout-commit', hash);
    } catch (error) {
      console.error('切换提交失败:', error);
      throw error;
    }
  }

  async getCommits(branchName) {
    if (!branchName) {
      throw new Error('分支名称不能为空');
    }

    try {
      await this.init();
      const commits = await this.ipcRenderer.invoke('git:get-commits', branchName);
      return commits;
    } catch (error) {
      console.error('获取提交记录失败:', error);
      return [];
    }
  }

  async commit(content) {
    if (!content) {
      throw new Error('提交内容不能为空');
    }

    try {
      await this.init();
      return await this.ipcRenderer.invoke('git:commit', content);
    } catch (error) {
      console.error('提交更改失败:', error);
      throw error;
    }
  }

  async createBranch(branchName) {
    if (!branchName) {
      throw new Error('分支名称不能为空');
    }

    try {
      await this.init();
      return await this.ipcRenderer.invoke('git:create-branch', branchName);
    } catch (error) {
      console.error('创建分支失败:', error);
      throw error;
    }
  }
}

export default new GitService();
