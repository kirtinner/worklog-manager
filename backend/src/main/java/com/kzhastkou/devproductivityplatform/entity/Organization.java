package com.kzhastkou.devproductivityplatform.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "organizations")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Organization {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String shortName;

    @Column(nullable = false)
    private String fullName;
}