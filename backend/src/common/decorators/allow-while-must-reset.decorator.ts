import { SetMetadata } from '@nestjs/common';

export const ALLOW_WHILE_MUST_RESET_KEY = 'allowWhileMustReset';

export const AllowWhileMustReset = () =>
  SetMetadata(ALLOW_WHILE_MUST_RESET_KEY, true);
