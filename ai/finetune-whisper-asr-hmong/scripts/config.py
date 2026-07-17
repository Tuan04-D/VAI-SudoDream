class Config:
    DATA_DIR = "/workspace/hmong-asr-projects/dataset-preprocessed"
    LABEL_FILE = "label.csv"
    OUTPUT_DIR = "/workspace/hmong-asr-projects/outputs"

    MODEL_NAME = "openai/whisper-small"
    BATCH_SIZE = 16
    GRAD_ACCUM_STEPS = 4
    LR = 1e-5
    WEIGHT_DECAY = 0.01
    WARMUP_STEPS = 500

    MAX_EPOCHS = 500
    PATIENCE = 10
    PRECISION = "bf16-mixed"

    SEED = 42
    RUN_TEST_AFTER_TRAIN = True
    CKPT_PATH = "/workspace/hmong-asr-projects/outputs/whisper_small_ft/version_0/checkpoints/best-epoch=021-val_wer=0.1226.ckpt"
