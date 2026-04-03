export const createSpeechRecognition = (
    language = "en",
    onResult,
    onError
) => {
    const SpeechRecognition =
        window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
        throw new Error("Web Speech API not supported in this browser");
    }

    const recognition = new SpeechRecognition();
    recognition.lang = language;
    recognition.continuous = true;
    recognition.interimResults = false;

    recognition.onresult = (event) => {
        const lastIndex = event.results.length - 1;
        const transcript = event.results[lastIndex][0].transcript;
        onResult(transcript);
    };

    recognition.onerror = (event) => {
        if (onError) onError(event.error);
    };

    return recognition;
};
