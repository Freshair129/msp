from setuptools import setup

setup(
    name="qwen-cli",
    version="1.0.0",
    description="Local LLM CLI for Claude delegation via Ollama",
    py_modules=["qwen"],
    install_requires=["requests"],
    entry_points={
        "console_scripts": [
            "qwen=qwen:main",
        ],
    },
    python_requires=">=3.8",
)
