class SyntaxService {
  // IP地址的正则表达式（更严格的版本）
  static IP_REGEX = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  
  // 域名的正则表达式（更严格的版本，包含常见顶级域名）
  static DOMAIN_REGEX = /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+(?:com|net|org|edu|gov|mil|biz|info|mobi|name|aero|asia|jobs|museum|[a-zA-Z]{2})$/;

  // 注释的正则表达式
  static COMMENT_REGEX = /^#.*$/;

  // 验证一行 hosts 内容
  validateLine(line, lineNumber) {
    const errors = [];
    const trimmedLine = line.trim();

    // 跳过空行和注释行
    if (!trimmedLine || trimmedLine.startsWith('#')) {
      return { isValid: true, errors: [] };
    }

    const parts = trimmedLine.split(/\s+/);
    
    // 检查基本格式
    if (parts.length < 2) {
      errors.push({
        line: lineNumber,
        message: '每行必须包含 IP 地址和至少一个域名',
        type: 'format'
      });
      return { isValid: false, errors };
    }

    // 检查 IP 地址
    const ip = parts[0];
    if (!SyntaxService.IP_REGEX.test(ip)) {
      errors.push({
        line: lineNumber,
        message: `无效的 IP 地址: ${ip}`,
        type: 'ip',
        position: line.indexOf(ip)
      });
    }

    // 检查域名
    const domains = parts.slice(1).filter(d => !d.startsWith('#'));
    domains.forEach(domain => {
      if (!SyntaxService.DOMAIN_REGEX.test(domain)) {
        errors.push({
          line: lineNumber,
          message: `无效的域名: ${domain}`,
          type: 'domain',
          position: line.indexOf(domain)
        });
      }
    });

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // 验证整个 hosts 文件
  validateContent(content) {
    const lines = content.split('\n');
    const allErrors = [];
    let isValid = true;

    lines.forEach((line, index) => {
      const { isValid: lineValid, errors } = this.validateLine(line, index + 1);
      if (!lineValid) {
        isValid = false;
        allErrors.push(...errors);
      }
    });

    return {
      isValid,
      errors: allErrors
    };
  }

  // 高亮一行文本（包含错误高亮）
  highlight(line, lineNumber) {
    const validation = this.validateLine(line, lineNumber);
    const parts = line.trim().split(/\s+/);
    let html = '';

    if (line.trim().startsWith('#')) {
      // 注释行
      html = `<span class="hosts-comment">${line}</span>`;
    } else if (parts.length >= 2) {
      // IP 地址
      const ip = parts[0];
      const ipError = validation.errors.find(e => e.type === 'ip');
      html = ipError 
        ? `<span class="hosts-ip error" title="${ipError.message}">${ip}</span>`
        : `<span class="hosts-ip">${ip}</span>`;

      // 域名和注释
      for (let i = 1; i < parts.length; i++) {
        const part = parts[i];
        if (part.startsWith('#')) {
          html += ` <span class="hosts-comment">${parts.slice(i).join(' ')}</span>`;
          break;
        } else {
          const domainError = validation.errors.find(e => e.type === 'domain' && e.position === line.indexOf(part));
          html += domainError
            ? ` <span class="hosts-domain error" title="${domainError.message}">${part}</span>`
            : ` <span class="hosts-domain">${part}</span>`;
        }
      }
    } else {
      html = line;
    }

    return html;
  }

  // 高亮整个文本
  highlightText(text) {
    return text.split('\n')
      .map((line, index) => {
        const lineNumber = index + 1;
        const highlightedLine = this.highlight(line, lineNumber);
        return `
          <div class="hosts-line" data-line="${lineNumber}">
            <span class="line-number">${lineNumber}</span>
            <span class="line-content">${highlightedLine}</span>
          </div>
        `;
      })
      .join('');
  }

  // 切换行注释状态
  toggleLineComment(line) {
    if (line.trim().startsWith('#')) {
      return line.replace(/^#\s*/, '');
    } else {
      return `# ${line}`;
    }
  }

  // 检测域名冲突
  detectConflicts(content) {
    const domainMap = new Map(); // 存储域名到IP的映射
    const conflicts = []; // 存储冲突信息

    const lines = content.split('\n');
    lines.forEach((line, index) => {
      const lineNumber = index + 1;
      const trimmedLine = line.trim();

      // 跳过空行和注释行
      if (!trimmedLine || trimmedLine.startsWith('#')) {
        return;
      }

      const parts = trimmedLine.split(/\s+/);
      if (parts.length < 2) return;

      const ip = parts[0];
      const domains = parts.slice(1).filter(d => !d.startsWith('#'));

      domains.forEach(domain => {
        if (domainMap.has(domain)) {
          const existingIp = domainMap.get(domain);
          if (existingIp !== ip) {
            conflicts.push({
              domain,
              currentIp: ip,
              existingIp,
              currentLine: lineNumber,
              existingLine: domainMap.get(`${domain}_line`)
            });
          }
        } else {
          domainMap.set(domain, ip);
          domainMap.set(`${domain}_line`, lineNumber);
        }
      });
    });

    return {
      hasConflicts: conflicts.length > 0,
      conflicts
    };
  }

  // 合并多个方案内容并检测冲突
  mergeAndValidate(schemes) {
    const mergedContent = schemes.map(s => s.content).join('\n\n');
    const conflicts = this.detectConflicts(mergedContent);
    
    return {
      content: mergedContent,
      ...conflicts
    };
  }
}

export default new SyntaxService(); 