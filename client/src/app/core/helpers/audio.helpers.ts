import { SoundEffect } from '../../models/enums/sound-effect.enum';
import { Injectable } from '@angular/core';
import { LocalStorageService } from '../services/local-storage.service';
import { isNil } from './type.helpers';
import { StorageKey } from '../../models/enums/storage-key.enum';

@Injectable({
    providedIn: 'root'
})
export class AudioHelpers {
    private sounds: HTMLAudioElement[] = [];
    private audioPath = '/assets/audio/';

    public get hasAudioEffects() {
        const hasAudio = this.localStorageService.get(StorageKey.AudioEffects);
        return !isNil(hasAudio) ? hasAudio : true;
    }

    constructor(private readonly localStorageService: LocalStorageService) {
        this.initSounds();
    }

    public initSounds() {
        Object.keys(SoundEffect).forEach((key) => {
            this.sounds.push(new Audio(`${this.audioPath}${SoundEffect[key]}`));
        });

        this.sounds.forEach((item) => {
            item.muted = !this.hasAudioEffects;
        });
    }

    public getSound(url: SoundEffect) {
        return this.sounds.find((item) => item.src.includes(url));
    }

    public playSound(url: SoundEffect) {
        const sound = this.getSound(url) || new Audio(`${this.audioPath}${url}`);
        if (!sound.paused || sound.currentTime) {
            setTimeout(() => {
                sound.pause();
                sound.currentTime = 0;
            });
        }
        setTimeout(() => {
            sound.play();
            console.log('>>> AUDIO: playing sound');
        }, 150);
    }

    public toggleAudioEffects(isEnabled: boolean) {
        this.localStorageService.set(StorageKey.AudioEffects, isEnabled);

        this.sounds.forEach((item) => {
            item.muted = !isEnabled;
        });
    }
}
