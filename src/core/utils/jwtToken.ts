import dotenvx from '@dotenvx/dotenvx';
import { JwtClaims } from '@models/authModel';
import jwt from 'jsonwebtoken';

dotenvx.config();

const refreshSecret: string = process.env.REFRESH_SECRET ?? "NO";
const accessSecret: string = process.env.REFRESH_SECRET ?? "NO";

export const refreshToken = (claims: JwtClaims) => {
    if (refreshSecret == "NO") { throw new Error("Must set REFRESH_SECRET env variable"); }
    return jwt.sign(claims, refreshSecret, { expiresIn: "7d" });
};
export const accessToken = (claims: JwtClaims) => {
    if (accessSecret == "NO") { throw new Error("Must set ACCESS_SECRET env variable"); }
    return jwt.sign(claims, accessSecret, { expiresIn: "3h" });
};

export const verifyRefresh = (token: string) => {
    if (refreshSecret == "NO") { throw new Error("Must set REFRESH_SECRET env variable"); }
    return jwt.verify(token, refreshSecret);
};

export const verifyAccess = (token: string) => {
    if (accessSecret == "NO") { throw new Error("Must set ACCESS_SECRET env variable"); }
    return jwt.verify(token, accessSecret);
};

export const decodeRefresh = (token: string) => {
    if (refreshSecret == "NO") { throw new Error("Must set REFRESH_SECRET env variable"); }
    return jwt.decode(token);
};

export const decodeAccess = (token: string) => {
    if (accessSecret == "NO") { throw new Error("Must set ACCESS_SECRET env variable"); }
    return jwt.decode(token);
};