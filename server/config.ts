type Config = {
    server: {
        port: number;
    }
    twilio: {
        accountSid: string;
        authToken: string;
    };
    peerjs: {
        port: number;
        username: string;
        credential: string;
    };
};

const missingEnvVars: string[] = [];
export const getEnvValue = <T = string | number | boolean>(
    envVar: string,
    fallback?: T,
): T => {
    let value = process.env[envVar] ?? fallback;

    if (value === undefined) {
        missingEnvVars.push(envVar);
    }

    return value as T;
};

export const isProduction =
    getEnvValue<string>("NODE_ENV", "development") === "production";

export const config: Config = {
    server: {
        port: 8002,
    },
    twilio: {
        accountSid: getEnvValue("GAMERS_TWILIO_ACCOUNT_SID"),
        authToken: getEnvValue("GAMERS_TWILIO_AUTH_TOKEN"),
    },
    peerjs: {
        port: 443,
        username: getEnvValue("GAMERS_ICE_SERVER_USERNAME"),
        credential: getEnvValue("GAMERS_ICE_SERVER_CREDENTIAL"),
    },
};

if (missingEnvVars.length > 0) {
    // eslint-disable-next-line no-console
    console.error(
        "ERROR: Mandatory environmental variable(s) are missing:\n",
        missingEnvVars.join(", ")
    );
    throw new Error("Missing env variable");
}
