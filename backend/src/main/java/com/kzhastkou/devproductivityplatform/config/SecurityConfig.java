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
                        .requestMatchers("/api/organizations").permitAll()
                        .requestMatchers("/api/organizations/").permitAll()
                        .requestMatchers("/api/organizations/**").permitAll()
                        .requestMatchers("/api/clients").permitAll()
                        .requestMatchers("/api/clients/").permitAll()
                        .requestMatchers("/api/clients/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/user-settings").permitAll()
                        .requestMatchers(HttpMethod.PUT, "/api/user-settings").permitAll()
                        .requestMatchers(HttpMethod.OPTIONS, "/api/user-settings").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/user-settings/").permitAll()
                        .requestMatchers(HttpMethod.PUT, "/api/user-settings/").permitAll()
                        .requestMatchers(HttpMethod.OPTIONS, "/api/user-settings/").permitAll()
                        .requestMatchers("/api/user-settings").permitAll()
                        .requestMatchers("/api/user-settings/").permitAll()
                        .requestMatchers("/api/user-settings/**").permitAll()
                        .requestMatchers("/api/software-products").permitAll()
                        .requestMatchers("/api/software-products/").permitAll()
                        .requestMatchers("/api/software-products/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/tasks/my").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/tasks/{id}/delete-check").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/tasks/{id}/time-entries").authenticated()
                        .requestMatchers(HttpMethod.DELETE, "/api/tasks/{id}").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/time-entries").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/time-entries/month").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/time-entries/**").permitAll()
                        .requestMatchers(HttpMethod.PUT, "/api/time-entries/day").permitAll()
                        .anyRequest().authenticated()
                )
                .addFilterBefore(jwtFilter,
                        org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }
}
