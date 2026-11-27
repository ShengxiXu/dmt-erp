package com.dmt.erp.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class Knife4jConfig {

    @Bean
    public OpenAPI dmtOpenAPI() {
        return new OpenAPI().info(new Info()
                .title("DMT-ERP 接口文档")
                .description("后端接口契约与数据字典 v0.2")
                .version("v0.2"));
    }
}
