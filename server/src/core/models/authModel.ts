export interface JwtClaims {
    userName: string,
}

export interface JwtResponse {
    accessToken: string,
    type: string,
}