export class MemoryPanel {
  constructor({ root, onSave, onDelete, onClose, onPickPhotos, onPickVideo }) {
    this.root = root;
    this.onSave = onSave;
    this.onDelete = onDelete;
    this.onClose = onClose;
    this.onPickPhotos = onPickPhotos;
    this.onPickVideo = onPickVideo;

    this.modeLabel = root.querySelector('#panel-mode');
    this.titleEl = root.querySelector('#panel-title');
    this.titleInput = root.querySelector('#field-title');
    this.textInput = root.querySelector('#field-text');
    this.photoGrid = root.querySelector('#photo-grid');
    this.videoSlot = root.querySelector('#video-slot');

    this.current = null;

    root.querySelector('#btn-close-panel').addEventListener('click', () => this.close());
    root.querySelector('#btn-save-star').addEventListener('click', () => this.save());
    root.querySelector('#btn-delete-star').addEventListener('click', () => {
      if (this.current) this.onDelete(this.current.id);
    });
    root.querySelector('#btn-add-photo').addEventListener('click', () => this.onPickPhotos());
    root.querySelector('#btn-add-video').addEventListener('click', () => this.onPickVideo());

    this.titleInput.addEventListener('input', () => {
      this.titleEl.textContent = this.titleInput.value.trim() || '未命名的星';
    });
  }

  open(star, { mode = 'edit' } = {}) {
    this.current = structuredClone(star);
    this.modeLabel.textContent = mode === 'create' ? '点亮新星' : '记忆星辰';
    this.titleEl.textContent = star.title?.trim() || '未命名的星';
    this.titleInput.value = star.title || '';
    this.textInput.value = star.text || '';
    this.renderPhotos(star.photos || []);
    this.renderVideo(star.video || null);
    this.root.hidden = false;
  }

  close() {
    this.root.hidden = true;
    this.current = null;
    this.onClose?.();
  }

  renderPhotos(photos) {
    this.photoGrid.innerHTML = '';
    if (!photos.length) {
      const empty = document.createElement('div');
      empty.className = 'video-slot empty';
      empty.style.gridColumn = '1 / -1';
      empty.textContent = '还没有照片';
      this.photoGrid.appendChild(empty);
      return;
    }

    for (const photo of photos) {
      const item = document.createElement('div');
      item.className = 'photo-item';
      const img = document.createElement('img');
      img.src = photo.url;
      img.alt = photo.name || 'memory photo';
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.textContent = '×';
      remove.addEventListener('click', () => {
        if (!this.current) return;
        this.current.photos = (this.current.photos || []).filter((p) => p.id !== photo.id);
        this.renderPhotos(this.current.photos);
      });
      item.append(img, remove);
      this.photoGrid.appendChild(item);
    }
  }

  renderVideo(video) {
    this.videoSlot.innerHTML = '';
    if (!video) {
      this.videoSlot.className = 'video-slot empty';
      this.videoSlot.textContent = '尚未添加视频';
      return;
    }

    this.videoSlot.className = 'video-slot has-video';
    const player = document.createElement('video');
    player.src = video.url;
    player.controls = true;
    player.preload = 'metadata';

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'ghost small';
    remove.style.marginTop = '8px';
    remove.textContent = '移除视频';
    remove.addEventListener('click', () => {
      if (!this.current) return;
      this.current.video = null;
      this.renderVideo(null);
    });

    this.videoSlot.append(player, remove);
  }

  addPhotos(photos) {
    if (!this.current) return;
    this.current.photos = [...(this.current.photos || []), ...photos];
    this.renderPhotos(this.current.photos);
  }

  setVideo(video) {
    if (!this.current) return;
    this.current.video = video;
    this.renderVideo(video);
  }

  save() {
    if (!this.current) return;
    const next = {
      ...this.current,
      title: this.titleInput.value.trim() || '未命名的星',
      text: this.textInput.value,
      photos: this.current.photos || [],
      video: this.current.video || null,
    };
    this.current = next;
    this.onSave(next);
    this.close();
  }
}
