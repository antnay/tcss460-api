import dotenvx from '@dotenvx/dotenvx';
import { JwtClaims } from '@models/authModel';
import { sign } from 'jsonwebtoken';

dotenvx.config({ path: '../.env' });

const refreshSecret: string = process.env.REFRESH_SECRET ?? "NO";
const accessSecret: string = process.env.REFRESH_SECRET ?? "NO";

export const refreshToken = (claims: JwtClaims) => {
    if (refreshSecret == "NO") { throw new Error("Must set REFRESH_SECRET env variable"); }
    return sign(claims, refreshSecret, { expiresIn: "7d" });
};
export const accessToken = (claims: JwtClaims) => {
    if (accessSecret == "NO") { throw new Error("Must set ACCESS_SECRET env variable"); }
    return sign(claims, accessSecret, { expiresIn: "3h" });
}

