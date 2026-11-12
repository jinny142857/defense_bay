// 효과음/배경음 재생기. Web Audio API로 미리 디코딩해두고 겹쳐 재생해야 연사할 때 끊기지
// 않는다(<audio> 엘리먼트 하나로는 같은 소리를 빠르게 여러 번 겹쳐 틀 수 없다).
// 브라우저는 사용자 제스처(클릭 등) 전엔 AudioContext를 막아두므로, 첫 포인터 입력 때 resume한다.

const SOUND_URLS = {
  cannonFire: '/sounds/cannon_fire.wav',
  explosion1: '/sounds/explosion_1.wav',
  explosion2: '/sounds/explosion_2.wav',
  explosion3: '/sounds/explosion_3.wav',
  airstrike: '/sounds/airstrike.wav',
  bossRoar: '/sounds/boss_roar.wav',
  rainLoop: '/sounds/rain_coast_loop.wav',
} as const

type SoundName = keyof typeof SOUND_URLS

const EXPLOSION_VARIANTS: SoundName[] = ['explosion1', 'explosion2', 'explosion3']

class SoundManager {
  private ctx: AudioContext | null = null
  private buffers = new Map<SoundName, AudioBuffer>()
  private loading = new Map<SoundName, Promise<AudioBuffer | null>>()
  private masterGain: GainNode | null = null
  private loopSources = new Map<string, AudioBufferSourceNode>()
  private resumeBound = false

  private getCtx(): AudioContext | null {
    if (typeof window === 'undefined') return null
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!Ctor) return null
      this.ctx = new Ctor()
      this.masterGain = this.ctx.createGain()
      this.masterGain.connect(this.ctx.destination)
    }
    if (!this.resumeBound) {
      this.resumeBound = true
      const resume = () => {
        this.ctx?.resume().catch(() => {})
      }
      window.addEventListener('pointerdown', resume, { once: true })
      window.addEventListener('keydown', resume, { once: true })
    }
    return this.ctx
  }

  private async load(name: SoundName): Promise<AudioBuffer | null> {
    const ctx = this.getCtx()
    if (!ctx) return null
    const cached = this.buffers.get(name)
    if (cached) return cached
    const pending = this.loading.get(name)
    if (pending) return pending
    const promise = fetch(SOUND_URLS[name])
      .then((res) => res.arrayBuffer())
      .then((data) => ctx.decodeAudioData(data))
      .then((buf) => {
        this.buffers.set(name, buf)
        return buf
      })
      .catch(() => null)
    this.loading.set(name, promise)
    return promise
  }

  // 자주 쓰는 소리는 앱이 뜨자마자 미리 받아둬서, 처음 쏠 때 지연 없이 바로 재생되게 한다.
  preloadAll() {
    ;(Object.keys(SOUND_URLS) as SoundName[]).forEach((name) => {
      this.load(name)
    })
  }

  async play(name: SoundName, { volume = 1, rate = 1 }: { volume?: number; rate?: number } = {}) {
    const ctx = this.getCtx()
    if (!ctx || !this.masterGain) return
    const buf = await this.load(name)
    if (!buf) return
    const source = ctx.createBufferSource()
    source.buffer = buf
    source.playbackRate.value = rate
    const gain = ctx.createGain()
    gain.gain.value = volume
    source.connect(gain)
    gain.connect(this.masterGain)
    source.start()
  }

  // 발사음은 매번 약간 피치를 흔들어줘야 같은 소리 반복이라는 티가 덜 난다.
  playCannonFire() {
    this.play('cannonFire', { volume: 0.7, rate: 0.95 + Math.random() * 0.1 })
  }

  playExplosion() {
    const name = EXPLOSION_VARIANTS[Math.floor(Math.random() * EXPLOSION_VARIANTS.length)]
    this.play(name, { volume: 0.8, rate: 0.95 + Math.random() * 0.1 })
  }

  playAirstrike() {
    this.play('airstrike', { volume: 0.9 })
  }

  playBossRoar() {
    this.play('bossRoar', { volume: 1 })
  }

  startLoop(key: string, name: SoundName, volume = 0.35) {
    const ctx = this.getCtx()
    if (!ctx || !this.masterGain) return
    if (this.loopSources.has(key)) return
    this.load(name).then((buf) => {
      if (!buf || this.loopSources.has(key)) return
      const source = ctx.createBufferSource()
      source.buffer = buf
      source.loop = true
      const gain = ctx.createGain()
      gain.gain.value = volume
      source.connect(gain)
      gain.connect(this.masterGain!)
      source.start()
      this.loopSources.set(key, source)
    })
  }

  stopLoop(key: string) {
    const source = this.loopSources.get(key)
    if (source) {
      try {
        source.stop()
      } catch {
        // 이미 멈춘 경우 무시
      }
      this.loopSources.delete(key)
    }
  }
}

export const sound = new SoundManager()
