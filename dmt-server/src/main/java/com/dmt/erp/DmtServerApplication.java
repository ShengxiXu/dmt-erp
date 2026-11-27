package com.dmt.erp;

import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
@MapperScan("com.dmt.erp.**.mapper")
public class DmtServerApplication {

    public static void main(String[] args) {
        SpringApplication.run(DmtServerApplication.class, args);
    }
}
