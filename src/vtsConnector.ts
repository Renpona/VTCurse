import { ApiClient, VTubeStudioError } from "vtubestudio";
import { ConnectionStatus, ExitCode, FormType } from "./enums";
import { errorHalt, pluginName } from "./utils";
import { updateStatus } from "./electron/electronMain";
import { cancelUpdate } from "./intifaceConnector";

// CommonJS/Require
const fs = require("node:fs");
const ws = require("ws");

function setAuthToken(authenticationToken) {
    // store the authentication token somewhere
    fs.writeFileSync("./auth-token.txt", authenticationToken, {
        encoding: "utf-8",
    });
    return Promise.resolve();
}

function getAuthToken() {
    // retrieve the stored authentication token
    return fs.readFileSync("./auth-token.txt", "utf-8");
}

const options = {
    authTokenGetter: getAuthToken,
    authTokenSetter: setAuthToken,
    pluginName: pluginName,
    pluginDeveloper: "Renpona",
    webSocketFactory: (url) => new ws(url),

    // default URL, to be overwritten if new info provided
    url: "ws://localhost:8001",
};

var apiClient: ApiClient;

function connectVTubeStudio(host, port) {
    options.url = `ws://${host}:${port}`;
    apiClient = new ApiClient(options);
    apiClient.on("connect", () => {
        console.log("Connected to VTubeStudio!");
        updateStatus(FormType.Vtuber, ConnectionStatus.Connected, "VTubeStudio connected!");
        addParam();
    });
    apiClient.on("error", (e: string) => {
        updateStatus(FormType.Vtuber, ConnectionStatus.Error, "VTubeStudio disconnected with error: \n" + e);
        //errorHalt("VTubeStudio connection failed or dropped", ExitCode.VtuberConnectionFailed, new Error(e));
    });
    apiClient.on("disconnect", () => {
        updateStatus(FormType.Vtuber, ConnectionStatus.Disconnected, "Disconnected from VTubeStudio");
        //errorHalt("VTubeStudio connection failed or dropped", ExitCode.VtuberConnectionFailed, new Error(e));
    });
    
    return apiClient;
}

function disconnectVtubeStudio() {
    apiClient.disconnect();
}

function addParam() {
    const linearParam = {
        parameterName: "Linear",
        explanation: "Linear actuator position",
        defaultValue: 0,
        min: 0,
        max: 1
    };
    const vibrateParam = {
        parameterName: "Vibrate",
        explanation: "Vibration level",
        defaultValue: 0,
        min: 0,
        max: 1
    };
    
    apiClient
        .parameterCreation(linearParam)
        .then((response) => {
            console.log("Successfully added parameter:", response.parameterName);
        })
        .catch((e) => {
            console.error("Failed to add parameter:", e.errorID, e.message);
        });
    apiClient
        .parameterCreation(vibrateParam)
        .then((response) => {
            console.log("Successfully added parameter:", response.parameterName);
        })
        .catch((e) => {
            console.error("Failed to add parameter:", e.errorID, e.message);
        });
}

function sendParamValue(param: string, value: number) {
    let paramData = {
        mode: "set" as "set",
        "parameterValues": [
            {
                "id": param,
                "value": value,
            }
        ]
    }
    apiClient
        .injectParameterData(paramData)
        .catch((e: VTubeStudioError) => {
            console.error("Failed to send param data %s:", param, e.data.message);
            updateStatus(FormType.Vtuber, ConnectionStatus.Error, "VTubeStudio connection error: Code " + e.data.errorID.toString() + "\n" + e.data.message);
            cancelUpdate();
        });
}

export { connectVTubeStudio, disconnectVtubeStudio, sendParamValue }