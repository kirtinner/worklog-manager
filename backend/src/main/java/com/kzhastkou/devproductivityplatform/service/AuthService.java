package com.kzhastkou.devproductivityplatform.service;

import com.kzhastkou.devproductivityplatform.dto.AuthResponse;
import com.kzhastkou.devproductivityplatform.dto.LoginRequest;
import com.kzhastkou.devproductivityplatform.entity.Developer;
import com.kzhastkou.devproductivityplatform.repository.DeveloperRepository;
import com.kzhastkou.devproductivityplatform.security.JwtService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final DeveloperRepository developerRepository;
    private final JwtService jwtService;

    public AuthResponse login(LoginRequest request) {

        Developer dev = developerRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new RuntimeException("User not found"));

        if (!dev.getPassword().equals(request.getPassword())) {
            throw new RuntimeException("Invalid password");
        }

        String token = jwtService.generateToken(dev.getId());

        return AuthResponse.builder()
                .token(token)
                .build();
    }
}
