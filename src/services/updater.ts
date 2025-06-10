import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
const fetch = require('node-fetch');

const execAsync = promisify(exec);

export interface UpdateInfo {
  hasUpdate: boolean;
  currentVersion: string;
  latestVersion: string;
  releaseUrl?: string;
  changes?: string;
}

export class UpdaterService {
  private checkInterval: NodeJS.Timeout | null = null;
  private readonly REPO_OWNER = 'david-strejc';
  private readonly REPO_NAME = 'cldmemory';
  private updateAvailable = false;
  private lastCheck = 0;
  
  async checkForUpdates(): Promise<UpdateInfo> {
    try {
      // Rate limit: check at most once per minute
      const now = Date.now();
      if (now - this.lastCheck < 60000) {
        return {
          hasUpdate: this.updateAvailable,
          currentVersion: await this.getCurrentVersion(),
          latestVersion: await this.getCurrentVersion()
        };
      }
      this.lastCheck = now;

      // Get current version from package.json
      const currentVersion = await this.getCurrentVersion();
      
      // Get latest release from GitHub with timeout
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000); // 5 second timeout
      
      const response = await fetch(
        `https://api.github.com/repos/${this.REPO_OWNER}/${this.REPO_NAME}/releases/latest`,
        {
          headers: {
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'MCP-Memory-Server'
          },
          signal: controller.signal
        }
      ).finally(() => clearTimeout(timeout));
      
      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status}`);
      }
      
      const release = await response.json() as any;
      const latestVersion = release.tag_name.replace('v', '');
      
      this.updateAvailable = this.isNewerVersion(currentVersion, latestVersion);
      
      return {
        hasUpdate: this.updateAvailable,
        currentVersion,
        latestVersion,
        releaseUrl: release.html_url,
        changes: release.body
      };
    } catch (error) {
      console.error('Error checking for updates:', error);
      return {
        hasUpdate: false,
        currentVersion: await this.getCurrentVersion(),
        latestVersion: await this.getCurrentVersion()
      };
    }
  }
  
  async performUpdate(): Promise<{ success: boolean; message: string }> {
    try {
      console.log('🔄 Starting auto-update...');
      
      // Check for uncommitted changes
      const { stdout: statusOut } = await execAsync('git status --porcelain');
      if (statusOut.trim()) {
        return {
          success: false,
          message: 'Cannot update: uncommitted changes detected. Please commit or stash them first.'
        };
      }
      
      // Fetch latest changes
      console.log('📥 Fetching updates...');
      await execAsync('git fetch origin main');
      
      // Pull changes
      console.log('🔄 Applying updates...');
      await execAsync('git pull origin main');
      
      // Install dependencies
      console.log('📦 Installing dependencies...');
      await execAsync('npm install');
      
      // Build
      console.log('🔨 Building...');
      await execAsync('npm run build');
      
      console.log('✅ Update complete!');
      
      // Store update info in memory
      await this.storeUpdateMemory();
      
      return {
        success: true,
        message: 'Update completed successfully! Please restart the MCP server for changes to take effect.'
      };
    } catch (error) {
      console.error('Update failed:', error);
      return {
        success: false,
        message: `Update failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
  
  startPeriodicChecks(intervalMinutes: number = 30): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
    
    // Initial check
    this.checkForUpdates().then(info => {
      if (info.hasUpdate) {
        console.log(`🔔 Update available: v${info.currentVersion} → v${info.latestVersion}`);
      }
    });
    
    // Periodic checks
    this.checkInterval = setInterval(async () => {
      const info = await this.checkForUpdates();
      if (info.hasUpdate) {
        console.log(`🔔 Update available: v${info.currentVersion} → v${info.latestVersion}`);
      }
    }, intervalMinutes * 60 * 1000);
  }
  
  stopPeriodicChecks(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }
  
  private async getCurrentVersion(): Promise<string> {
    const packagePath = path.join(process.cwd(), 'package.json');
    const packageJson = JSON.parse(await fs.readFile(packagePath, 'utf-8'));
    return packageJson.version;
  }
  
  private isNewerVersion(current: string, latest: string): boolean {
    const currentParts = current.split('.').map(Number);
    const latestParts = latest.split('.').map(Number);
    
    for (let i = 0; i < 3; i++) {
      if (latestParts[i] > currentParts[i]) return true;
      if (latestParts[i] < currentParts[i]) return false;
    }
    
    return false;
  }
  
  private async storeUpdateMemory(): Promise<void> {
    // This will be called from the memory service to avoid circular dependency
    const version = await this.getCurrentVersion();
    console.log(`📝 Storing update memory for version ${version}`);
  }
}