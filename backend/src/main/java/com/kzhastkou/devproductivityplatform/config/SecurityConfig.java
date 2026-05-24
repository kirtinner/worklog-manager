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
                        .requestMatchers("/api/auth/**").permitAll()
                        .requestMatchers("/api/organizations/**").hasAnyRole("USER", "ADMIN")
                        .requestMatchers("/api/clients/**").hasAnyRole("USER", "ADMIN")
                        .requestMatchers("/api/projects/**").hasAnyRole("USER", "ADMIN")
                        .requestMatchers("/api/software-products/**").hasAnyRole("USER", "ADMIN")
                        .requestMatchers("/api/tasks/**").hasAnyRole("USER", "ADMIN")
                        .requestMatchers("/api/time-entries/**").hasAnyRole("USER", "ADMIN")
                        .requestMatchers("/api/user-settings/**").hasAnyRole("USER", "ADMIN")
                        .requestMatchers("/api/reports/**").hasAnyRole("USER", "ADMIN")
                        .anyRequest().authenticated()
                )
                .addFilterBefore(jwtFilter,
                        org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }
}
