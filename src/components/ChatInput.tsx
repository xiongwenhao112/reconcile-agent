import { useState, useRef, useCallback, KeyboardEvent, DragEvent, ChangeEvent, ClipboardEvent } from 'react';
import { useT, MessageKeys } from '../i18n';
import type { FileAttachment } from '../types';
import styles from './ChatInput.module.css';

interface Props {
  onSend: (text: string, files?: FileAttachment[]) => void;
  onStop: () => void;
  onClear: () => void;
  disabled: boolean;
}

const PRESET_KEYS = ['preset.1', 'preset.2', 'preset.4'] as const;

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

function fileToAttachment(file: File): Promise<FileAttachment> {
  return new Promise((resolve, reject) => {
    if (file.size > MAX_FILE_SIZE) {
      reject(new Error(`文件 "${file.name}" 超过 10MB 限制`));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Strip data URI prefix, keep raw base64
      const base64 = result.split(',')[1] || result;
      resolve({
        name: file.name,
        size: file.size,
        type: file.type,
        data: base64,
      });
    };
    reader.onerror = () => reject(new Error(`读取文件 "${file.name}" 失败`));
    reader.readAsDataURL(file);
  });
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ChatInput({ onSend, onStop, onClear, disabled }: Props) {
  const [value, setValue] = useState('');
  const [files, setFiles] = useState<FileAttachment[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [fileError, setFileError] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { t } = useT();

  const clearFileError = () => setFileError('');

  const handleSend = useCallback(() => {
    const trimmed = value.trim();
    if ((!trimmed && files.length === 0) || disabled) return;
    onSend(trimmed || '请帮我对账以下文件', files.length > 0 ? files : undefined);
    setValue('');
    setFiles([]);
    clearFileError();
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [value, disabled, files, onSend]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  };

  const handlePreset = (text: string) => {
    if (disabled) return;
    onSend(text);
  };

  const addFiles = useCallback(async (fileList: FileList | File[]) => {
    clearFileError();
    const incoming = Array.from(fileList);
    const newFiles: FileAttachment[] = [];
    for (const file of incoming) {
      // Check if already added
      if (files.some(f => f.name === file.name && f.size === file.size)) continue;
      try {
        const attachment = await fileToAttachment(file);
        newFiles.push(attachment);
      } catch (err) {
        setFileError(err instanceof Error ? err.message : '文件读取失败');
        return;
      }
    }
    if (newFiles.length > 0) {
      setFiles(prev => [...prev, ...newFiles]);
    }
  }, [files]);

  const removeFile = useCallback((index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
    clearFileError();
  }, []);

  // File input handler
  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      void addFiles(e.target.files);
      // Reset input so same file can be selected again
      e.target.value = '';
    }
  };

  // Drag & drop handlers
  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) setDragOver(true);
  };
  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  };
  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    if (disabled) return;
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      void addFiles(e.dataTransfer.files);
    }
  };

  // Paste handler — support pasting images/files
  const handlePaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items || disabled) return;
    const pastedFiles: File[] = [];
    for (const item of Array.from(items)) {
      if (item.kind === 'file') {
        const file = item.getAsFile();
        if (file) pastedFiles.push(file);
      }
    }
    if (pastedFiles.length > 0) {
      e.preventDefault();
      void addFiles(pastedFiles);
    }
  };

  const handleFileButtonClick = () => {
    if (disabled) return;
    fileInputRef.current?.click();
  };

  return (
    <div
      className={`${styles.bar} ${dragOver ? styles.dragOver : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      {dragOver && (
        <div className={styles.dropOverlay}>
          <span className={styles.dropIcon}>📁</span>
          <span className={styles.dropText}>释放文件以上传</span>
        </div>
      )}

      {/* File list */}
      {files.length > 0 && (
        <div className={styles.fileList}>
          {files.map((f, i) => (
            <div key={`${f.name}-${i}`} className={styles.fileChip}>
              <span className={styles.fileIcon}>📄</span>
              <span className={styles.fileName}>{f.name}</span>
              <span className={styles.fileSize}>{formatSize(f.size)}</span>
              <button
                className={styles.fileRemove}
                onClick={() => removeFile(i)}
                disabled={disabled}
                title="移除文件"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Error message */}
      {fileError && <p className={styles.fileError}>{fileError}</p>}

      <div className={styles.presets}>
        {PRESET_KEYS.map(key => (
          <button
            key={key}
            className={styles.presetChip}
            onClick={() => handlePreset(t(key as MessageKeys))}
            disabled={disabled}
          >
            {t(key as MessageKeys)}
          </button>
        ))}
      </div>

      <div className={`${styles.inputWrap} ${disabled ? styles.inputDisabled : ''}`}>
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          className={styles.hiddenFileInput}
          onChange={handleFileChange}
          accept=".csv,.xls,.xlsx,.txt"
          multiple
        />

        {/* File upload button */}
        <button
          className={styles.attachBtn}
          onClick={handleFileButtonClick}
          disabled={disabled}
          aria-label="上传文件"
          title="上传 Excel/CSV 文件"
        >
          <svg viewBox="0 0 24 24" fill="none" width="18" height="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
          </svg>
        </button>

        <textarea
          ref={textareaRef}
          className={styles.textarea}
          placeholder={t("chat.placeholder")}
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onInput={handleInput}
          onPaste={handlePaste}
          rows={1}
          disabled={disabled}
        />
        <button
          className={`${styles.sendBtn} ${(!value.trim() && files.length === 0) || disabled ? styles.sendDisabled : ''}`}
          onClick={handleSend}
          disabled={(!value.trim() && files.length === 0) || disabled}
          aria-label={t("aria.send")}
        >
          <svg viewBox="0 0 20 20" fill="none" width="16" height="16">
            <path d="M3 10L17 3l-4 7 4 7L3 10z" fill="currentColor"/>
          </svg>
        </button>
        <button
          className={styles.clearBtn}
          onClick={onClear}
          disabled={disabled}
          aria-label={t("aria.clearHistory")}
          title={t("aria.clearHistory")}
        >
          <svg viewBox="0 0 24 24" fill="none" width="16" height="16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
            <path d="M10 11v6"/>
            <path d="M14 11v6"/>
            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
          </svg>
        </button>
        {disabled && (
          <button
            className={styles.stopBtn}
            onClick={onStop}
            aria-label={t("aria.stopGeneration")}
            title={t("aria.stopGeneration")}
          >
            <svg viewBox="0 0 20 20" fill="none" width="14" height="14">
              <rect x="4" y="4" width="12" height="12" rx="2" fill="currentColor"/>
            </svg>
          </button>
        )}
      </div>
      <p className={styles.hint}>{t("chat.hint")}</p>
    </div>
  );
}
