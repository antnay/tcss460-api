import { JwtClaims } from '@models/authModel';
import { refreshToken } from '@utils/jwtToken';
import { Request, Response } from 'express';

export const login = async (req: Request, res: Response) => {
    req.body.email;
};

export const register = async (req: Request, res: Response) => {
    req.body.username;
    req.body.email;
    req.body.password;

    const claims: JwtClaims = {userName: "kjfd"}
    const refresh = refreshToken(claims)
    res.cookie("refresh-token", refresh);
    res.send(200).json(
    );
};