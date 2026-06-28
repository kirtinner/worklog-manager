package com.kzhastkou.devproductivityplatform.config;

import com.kzhastkou.devproductivityplatform.security.JwtFilter;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtFilter jwtFilter;

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                .csrf(csrf -> csrf.disable())
                .cors(cors -> {})
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/auth/login", "/api/auth/register").permitAll()
                        .requestMatchers("/api/auth/me", "/api/auth/change-password").hasAnyRole("USER", "ADMIN")
                        .requestMatchers("/api/organizations", "/api/organizations/**").hasAnyRole("USER", "ADMIN")
                        .requestMatchers("/api/clients", "/api/clients/**").hasAnyRole("USER", "ADMIN")
                        .requestMatchers("/api/projects", "/api/projects/**").hasAnyRole("USER", "ADMIN")
                        .requestMatchers("/api/software-products", "/api/software-products/**").hasAnyRole("USER", "ADMIN")
                        .requestMatchers("/api/tasks", "/api/tasks/**").hasAnyRole("USER", "ADMIN")
                        .requestMatchers("/api/time-entries", "/api/time-entries/**").hasAnyRole("USER", "ADMIN")
                        .requestMatchers("/api/user-settings", "/api/user-settings/**").hasAnyRole("USER", "ADMIN")
                        .requestMatchers("/api/reports", "/api/reports/**").hasAnyRole("USER", "ADMIN")
                        .requestMatchers("/api/administration", "/api/administration/**").hasAnyRole("USER", "ADMIN")
                        .requestMatchers("/api/import", "/api/import/**").hasAnyRole("USER", "ADMIN")
                        .requestMatchers("/api/export", "/api/export/**").hasAnyRole("USER", "ADMIN")
                        .requestMatchers("/api/users", "/api/users/**").hasAnyRole("USER", "ADMIN")
                        .anyRequest().authenticated()
                )
                .addFilterBefore(jwtFilter,
                        org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }
}
