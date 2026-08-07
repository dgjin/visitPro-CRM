package com.visitpro.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.web.client.RestClient;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.time.Duration;

@Configuration
public class AppConfig {

    /** BCrypt（与 bcryptjs rounds=10 兼容） */
    @Bean
    public BCryptPasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(10);
    }

    /** Ollama 代理专用客户端（3s 超时，仅用于模型列表探测，对齐 Node 版 AbortSignal.timeout(3000)） */
    @Bean
    public RestClient ollamaClient(VisitProProperties props) {
        org.springframework.http.client.SimpleClientHttpRequestFactory factory =
                new org.springframework.http.client.SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofSeconds(3));
        factory.setReadTimeout(Duration.ofSeconds(3));
        return RestClient.builder()
                .baseUrl(props.ollama().base())
                .requestFactory(factory)
                .build();
    }

    /** Ollama 对话客户端（本地模型推理耗时较长，读超时放宽到 180s；Node 版 chat 无超时） */
    @Bean
    public RestClient ollamaChatClient(VisitProProperties props) {
        org.springframework.http.client.SimpleClientHttpRequestFactory factory =
                new org.springframework.http.client.SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofSeconds(3));
        factory.setReadTimeout(Duration.ofSeconds(180));
        return RestClient.builder()
                .baseUrl(props.ollama().base())
                .requestFactory(factory)
                .build();
    }

    /** CORS：仅允许配置的前端来源（vite 代理场景为同源，此配置兜底直连场景） */
    @Bean
    public WebMvcConfigurer corsConfigurer(VisitProProperties props) {
        return new WebMvcConfigurer() {
            @Override
            public void addCorsMappings(CorsRegistry registry) {
                registry.addMapping("/api/**")
                        .allowedOrigins(props.cors().origins().toArray(new String[0]))
                        .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
                        .allowedHeaders("*");
            }
        };
    }
}
