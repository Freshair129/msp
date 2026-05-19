import { App, TFile, TAbstractFile } from 'obsidian';

export class BridgeSync {
  constructor(private app: App) {}

  public initialize() {
    this.app.vault.on('modify', (file) => this.handleFileChange(file, 'modify'));
    this.app.vault.on('create', (file) => this.handleFileChange(file, 'create'));
    this.app.vault.on('delete', (file) => this.handleFileChange(file, 'delete'));
    this.app.vault.on('rename', (file, oldPath) => this.handleFileRename(file, oldPath));
    
    console.log('msp-bridge synchronization initialized');
  }

  private async handleFileChange(file: TAbstractFile, type: 'modify' | 'create' | 'delete') {
    if (!(file instanceof TFile) || file.extension !== 'md') return;
    
    console.log(`msp-bridge: detected ${type} on ${file.path}`);
    
    if (type === 'delete') {
      // TODO: Queue removal from vector store
      return;
    }

    // TODO: Queue update/creation in vector store
    // 1. Read file content
    // 2. Extract metadata
    // 3. Generate embedding (or send to server to generate)
    // 4. Update pgvector
  }

  private handleFileRename(file: TAbstractFile, oldPath: string) {
    if (!(file instanceof TFile) || file.extension !== 'md') return;
    
    console.log(`msp-bridge: detected rename from ${oldPath} to ${file.path}`);
    
    // TODO: Update path/source in vector store
  }
}
