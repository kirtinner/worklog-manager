package com.kzhastkou.devproductivityplatform.config;

import com.kzhastkou.devproductivityplatform.entity.SoftwareProduct;
import com.kzhastkou.devproductivityplatform.repository.DeveloperRepository;
import com.kzhastkou.devproductivityplatform.repository.SoftwareProductRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Component
@RequiredArgsConstructor
public class SoftwareProductDataInitializer implements ApplicationRunner {

    private final SoftwareProductRepository softwareProductRepository;
    private final DeveloperRepository developerRepository;

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        if (softwareProductRepository.count() > 0) {
            return;
        }

        var developer = developerRepository.findFirstByOrderByIdAsc().orElse(null);
        if (developer == null) {
            return;
        }

        softwareProductRepository.saveAll(List.of(
                SoftwareProduct.builder()
                        .developer(developer)
                        .shortName("ERP")
                        .fullName("Enterprise Resource Planning")
                        .build(),
                SoftwareProduct.builder()
                        .developer(developer)
                        .shortName("CRM")
                        .fullName("Customer Relationship Management")
                        .build(),
                SoftwareProduct.builder()
                        .developer(developer)
                        .shortName("FIN")
                        .fullName("Financial Operations Suite")
                        .build(),
                SoftwareProduct.builder()
                        .developer(developer)
                        .shortName("HR")
                        .fullName("Human Resources Platform")
                        .build()
        ));
    }
}
