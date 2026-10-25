import { SetMetadata } from '@nestjs/common';

export const ALLOW_GUEST = 'allowGuest';

export const GUEST_USER_ID = 0;

export const AllowGuest = () => SetMetadata(ALLOW_GUEST, true);
