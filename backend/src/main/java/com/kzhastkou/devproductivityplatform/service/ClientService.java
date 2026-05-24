package com.kzhastkou.devproductivityplatform.service;

import com.kzhastkou.devproductivityplatform.dto.ClientRequest;
import com.kzhastkou.devproductivityplatform.dto.ClientResponse;
import com.kzhastkou.devproductivityplatform.entity.Developer;
import com.kzhastkou.devproductivityplatform.entity.Client;
import com.kzhastkou.devproductivityplatform.entity.Organization;
import com.kzhastkou.devproductivityplatform.exception.NotFoundException;
import com.kzhastkou.devproductivityplatform.repository.ClientRepository;
import com.kzhastkou.devproductivityplatform.repository.DeveloperRepository;
import com.kzhastkou.devproductivityplatform.repository.OrganizationRepository;
import com.kzhastkou.devproductivityplatform.repository.ProjectRepository;
import com.kzhastkou.devproductivityplatform.repository.TaskRepository;
import com.kzhastkou.devproductivityplatform.repository.TimeEntryRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class ClientService {

    private final ClientRepository clientRepository;
    private final DeveloperRepository developerRepository;
    private final OrganizationRepository organizationRepository;
    private final ProjectRepository projectRepository;
    private final TaskRepository taskRepository;
    private final TimeEntryRepository timeEntryRepository;

    @Transactional(readOnly = true)
    public List<ClientResponse> findAll(Long developerId) {
        return clientRepository.findByDeveloperIdOrderByIdAsc(developerId)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public ClientResponse findById(Long id, Long developerId) {
        return toResponse(findEntity(id, developerId));
    }

    @Transactional
    public ClientResponse create(ClientRequest request, Long developerId) {
        Developer developer = resolveDeveloper(developerId);
        Organization organization = resolveOrganization(request.getOrganizationId(), developerId);

        Client client = Client.builder()
                .developer(developer)
                .organization(organization)
                .shortName(request.getShortName().trim())
                .fullName(request.getFullName().trim())
                .build();

        return toResponse(clientRepository.save(client));
    }

    @Transactional
    public ClientResponse update(Long id, ClientRequest request, Long developerId) {
        Client client = findEntity(id, developerId);
        Organization organization = resolveOrganization(request.getOrganizationId(), developerId);

        client.setOrganization(organization);
        client.setShortName(request.getShortName().trim());
        client.setFullName(request.getFullName().trim());
        return toResponse(clientRepository.save(client));
    }

    @Transactional
    public void delete(Long id, Long developerId) {
        findEntity(id, developerId);

        if (projectRepository.existsByDeveloperIdAndClientId(developerId, id)
                || taskRepository.existsByDeveloperIdAndClientId(developerId, id)
                || timeEntryRepository.existsByDeveloperIdAndTaskClientId(developerId, id)) {
            throw new RuntimeException("Client is used in the system and cannot be deleted.");
        }

        clientRepository.deleteById(id);
    }

    private Client findEntity(Long id, Long developerId) {
        return clientRepository.findByIdAndDeveloperId(id, developerId)
                .orElseThrow(() -> new NotFoundException("Client not found"));
    }

    private Developer resolveDeveloper(Long developerId) {
        return developerRepository.findById(developerId)
                .orElseThrow(() -> new NotFoundException("Developer not found"));
    }

    private Organization resolveOrganization(Long organizationId, Long developerId) {
        return organizationRepository.findByIdAndDeveloperId(organizationId, developerId)
                .orElseThrow(() -> new NotFoundException("Organization not found"));
    }

    private ClientResponse toResponse(Client client) {
        return ClientResponse.builder()
                .id(client.getId())
                .organizationId(client.getOrganization().getId())
                .organizationName(client.getOrganization().getShortName())
                .shortName(client.getShortName())
                .fullName(client.getFullName())
                .build();
    }
}
