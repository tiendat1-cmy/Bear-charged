from typing import Any


def success_response(message: str = "Success", data: Any = None) -> dict:
    return {"success": True, "message": message, "data": data}


def error_response(message: str = "Error", data: Any = None) -> dict:
    return {"success": False, "message": message, "data": data}
