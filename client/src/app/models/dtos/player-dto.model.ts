import { Role } from '../enums/role.enum';
import { Gender } from '../enums/gender.enum';

export class PlayerDto {
    public userId: string;
    public peerId: string;
    public roomId: string;
    public playerId: number;
    public videoId: string;
    public audioId: string;
    public role: Role;
    public previousRole: Role;
    public botName: string;
    public botGender: Gender;
    public isVideoMuted: boolean; // TODO: implement proper audio-only behavior
    public isAudioMuted: boolean;
    public isXpProcessed: boolean;

    public get isBot() {
        return !!this.userId && this.userId.split('_')[0] === 'BOT';
    }

    constructor(data?: Partial<PlayerDto>) {
        Object.assign(this, data);
    }
}
