package com.dmt.erp.common;

import jakarta.validation.ConstraintViolationException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.validation.BindException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.stream.Collectors;

@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(BizException.class)
    public ResponseEntity<R<Void>> handleBiz(BizException e) {
        ResultCode rc = e.getResultCode();
        HttpStatus status = switch (rc) {
            case UNAUTHENTICATED -> HttpStatus.UNAUTHORIZED;
            case FORBIDDEN -> HttpStatus.FORBIDDEN;
            case STATE_CONFLICT -> HttpStatus.CONFLICT;
            case PARAM_INVALID -> HttpStatus.BAD_REQUEST;
            default -> HttpStatus.OK;
        };
        return ResponseEntity.status(status).body(R.error(rc, e.getMessage()));
    }

    @ExceptionHandler({MethodArgumentNotValidException.class, BindException.class})
    public ResponseEntity<R<Void>> handleValidation(BindException e) {
        String msg = e.getBindingResult().getFieldErrors().stream()
                .map(f -> f.getField() + " " + f.getDefaultMessage())
                .collect(Collectors.joining("；"));
        return ResponseEntity.badRequest().body(R.error(ResultCode.PARAM_INVALID, msg));
    }

    @ExceptionHandler({ConstraintViolationException.class, MissingServletRequestParameterException.class,
            HttpMessageNotReadableException.class, IllegalArgumentException.class})
    public ResponseEntity<R<Void>> handleBadRequest(Exception e) {
        return ResponseEntity.badRequest().body(R.error(ResultCode.PARAM_INVALID, e.getMessage()));
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<R<Void>> handleAccessDenied(AccessDeniedException e) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(R.error(ResultCode.FORBIDDEN));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<R<Void>> handleUnknown(Exception e) {
        log.error("unhandled exception", e);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(R.error(ResultCode.SYSTEM_ERROR));
    }
}
