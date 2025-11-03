export interface JwtClaims {
    userName: string;
    role: string;
}

export interface JwtInfo {
    accessToken: string;
    type: string;
}

export interface JwtResponse {
    username: string;
    role: string;
    jwt: JwtInfo;
}

export interface User {
    user_id: number;
    username: string;
    role: string;
    password_hash: string;
    token: string;
}