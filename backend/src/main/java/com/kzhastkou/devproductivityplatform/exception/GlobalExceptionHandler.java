package com.kzhastkou.devproductivityplatform.exception;

import org.springframework.http.HttpStatus;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.transaction.UnexpectedRollbackException;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.bind.MethodArgumentNotValidException;

import java.time.LocalDateTime;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(NotFoundException.class)
    @ResponseStatus(HttpStatus.NOT_FOUND)
    public ErrorResponse handleNotFound(NotFoundException ex) {
        return ErrorResponse.builder()
                .message(ex.getMessage())
                .status(404)
                .timestamp(LocalDateTime.now())
                .build();
    }

    @ExceptionHandler(RuntimeException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ErrorResponse handleRuntime(RuntimeException ex) {
        return ErrorResponse.builder()
                .message(ex.getMessage())
                .status(400)
                .timestamp(LocalDateTime.now())
                .build();
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ErrorResponse handleDataIntegrity(DataIntegrityViolationException ex) {
        return ErrorResponse.builder()
                .message(resolveConstraintMessage(ex.getMostSpecificCause() != null
                        ? ex.getMostSpecificCause().getMessage()
                        : ex.getMessage()))
                .status(400)
                .timestamp(LocalDateTime.now())
                .build();
    }

    @ExceptionHandler(UnexpectedRollbackException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ErrorResponse handleUnexpectedRollback(UnexpectedRollbackException ex) {
        return ErrorResponse.builder()
                .message(resolveConstraintMessage(ex.getMessage()))
                .status(400)
                .timestamp(LocalDateTime.now())
                .build();
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ErrorResponse handleValidation(MethodArgumentNotValidException ex) {

        String message = ex.getBindingResult()
                .getFieldErrors()
                .stream()
                .map(error -> error.getField() + ": " + error.getDefaultMessage())
                .findFirst()
                .orElse("Validation error");

        return ErrorResponse.builder()
                .message(message)
                .status(400)
                .timestamp(LocalDateTime.now())
                .build();
    }

    private String resolveConstraintMessage(String message) {
        if (message != null && message.contains("ux_clients_developer_short_name")) {
            return "Import failed: client short_name must be unique for the current user. Check the Clients sheet for duplicate short_name values.";
        }

        if (message != null && message.contains("ux_projects_dev_org_client_short_name")) {
            return "Import failed: project short_name must be unique for the same organization and client. Check duplicate Projects rows with the same organization_code, client_code, and short_name.";
        }

        if (message != null && message.toLowerCase().contains("duplicate key")) {
            return "Import failed: the Excel data violates a unique database constraint. Check duplicate short_name values in the import file.";
        }

        return "Import failed: the Excel data violates a database constraint.";
    }
}
