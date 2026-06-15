import { BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { randomInt } from 'crypto';

const BCRYPT_COST = 12;
const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const LOWER = 'abcdefghijklmnopqrstuvwxyz';
const DIGITS = '0123456789';
const SYMBOLS = '-._~';
const TEMP_PASSWORD_CHARS = `${UPPER}${LOWER}${DIGITS}${SYMBOLS}`;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_COST);
}

export async function comparePassword(
  plain: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export function generateTempPassword(): string {
  const required = [
    randomChar(UPPER),
    randomChar(LOWER),
    randomChar(DIGITS),
    randomChar(SYMBOLS),
  ];

  while (required.length < 16) {
    required.push(randomChar(TEMP_PASSWORD_CHARS));
  }

  return shuffle(required).join('');
}

export function assertPasswordComplexity(plain: string): void {
  const isStrong =
    plain.length >= 8 &&
    /[A-Z]/.test(plain) &&
    /[a-z]/.test(plain) &&
    /\d/.test(plain);

  if (!isStrong) {
    throw new BadRequestException({
      code: 'WEAK_PASSWORD',
      message:
        'Password must be at least 8 characters and include uppercase, lowercase, and a digit.',
    });
  }
}

function randomChar(chars: string): string {
  return chars[randomInt(chars.length)];
}

function shuffle(chars: string[]): string[] {
  for (let index = chars.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(index + 1);
    [chars[index], chars[swapIndex]] = [chars[swapIndex], chars[index]];
  }

  return chars;
}
