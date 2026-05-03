"""业务异常 → HTTP 响应."""
from typing import Any


class BusinessError(Exception):
    code: str = "BUSINESS_ERROR"
    http_status: int = 400

    def __init__(self, message: str, *, details: dict[str, Any] | None = None) -> None:
        super().__init__(message)
        self.message = message
        self.details = details or {}


class NotFoundError(BusinessError):
    code = "NOT_FOUND"
    http_status = 404


class ValidationError(BusinessError):
    code = "VALIDATION_ERROR"
    http_status = 422


class ConflictError(BusinessError):
    code = "CONFLICT"
    http_status = 409


class AuthenticationError(BusinessError):
    code = "AUTHENTICATION_FAILED"
    http_status = 401


class AuthorizationError(BusinessError):
    code = "FORBIDDEN"
    http_status = 403


class InvalidTokenError(AuthenticationError):
    code = "INVALID_TOKEN"


class TokenReuseError(AuthenticationError):
    code = "TOKEN_REUSE"
