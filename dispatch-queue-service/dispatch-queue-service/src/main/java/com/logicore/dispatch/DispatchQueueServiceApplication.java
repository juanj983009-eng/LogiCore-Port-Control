package com.logicore.dispatch;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.web.client.RestTemplate;

@SpringBootApplication
public class DispatchQueueServiceApplication {

	public static void main(String[] args) {
		SpringApplication.run(DispatchQueueServiceApplication.class, args);
	}

	// Declaramos el Bean para que esté disponible en todo el microservicio
	@Bean
	public RestTemplate restTemplate() {
		return new RestTemplate();
	}
}