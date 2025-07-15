package ccmcommons

const CCMPerspectiveGridQuery = `
	query FetchperspectiveGrid(
		$filters: [QLCEViewFilterWrapperInput], 
		$groupBy: [QLCEViewGroupByInput], 
		$limit: Int, 
		$offset: Int, 
		$aggregateFunction: [QLCEViewAggregationInput], 
		$isClusterOnly: Boolean!, 
		$isClusterHourlyData: Boolean = null, 
		$preferences: ViewPreferencesInput
	) {
		perspectiveGrid(
			aggregateFunction: $aggregateFunction
			filters: $filters
			groupBy: $groupBy
			limit: $limit
			offset: $offset
			preferences: $preferences
			isClusterHourlyData: $isClusterHourlyData
			sortCriteria: [{sortType: COST, sortOrder: DESCENDING}]
		) {
			data {
				name
				id
				cost
				costTrend
				__typename
			}
			__typename
		}
		perspectiveTotalCount(
			filters: $filters
			groupBy: $groupBy
			isClusterQuery: $isClusterOnly
			isClusterHourlyData: $isClusterHourlyData
		)
	}`

const CCMPerspectiveTimeSeriesQuery = ` 
	query FetchPerspectiveTimeSeries(
		$filters: [QLCEViewFilterWrapperInput], 
		$groupBy: [QLCEViewGroupByInput], 
		$limit: Int, 
		$preferences: ViewPreferencesInput, 
		$isClusterHourlyData: Boolean = null
	) {
		perspectiveTimeSeriesStats(
			filters: $filters
			groupBy: $groupBy
			limit: $limit
			preferences: $preferences
			isClusterHourlyData: $isClusterHourlyData
			aggregateFunction: [{operationType: SUM, columnName: "cost"}]
			sortCriteria: [{sortType: COST, sortOrder: DESCENDING}]
		) {
			stats {
				values {
					key {
						id
						name
						type
						__typename
					}
					value
					__typename
				}
				time
				__typename
			}
			__typename
		}
	}
	`

const CCMPerspectiveSummaryWithBudgetQuery = `
	query FetchPerspectiveDetailsSummaryWithBudget(
		$filters: [QLCEViewFilterWrapperInput], 
		$aggregateFunction: [QLCEViewAggregationInput], 
		$isClusterQuery: Boolean, 
		$isClusterHourlyData: Boolean = null, 
		$groupBy: [QLCEViewGroupByInput], 
		$preferences: ViewPreferencesInput
	) {
		perspectiveTrendStats(
			filters: $filters
			aggregateFunction: $aggregateFunction
			isClusterQuery: $isClusterQuery
			isClusterHourlyData: $isClusterHourlyData
			groupBy: $groupBy
			preferences: $preferences
		) {
			cost {
				statsDescription
				statsLabel
				statsTrend
				statsValue
				value
				__typename
			}
			idleCost {
				statsLabel
				statsValue
				value
				__typename
			}
			unallocatedCost {
				statsLabel
				statsValue
				value
				__typename
			}
			utilizedCost {
				statsLabel
				statsValue
				value
				__typename
			}
			efficiencyScoreStats {
				statsLabel
				statsTrend
				statsValue
				__typename
			}
			__typename
		}
		perspectiveForecastCost(
			filters: $filters
			aggregateFunction: $aggregateFunction
			isClusterQuery: $isClusterQuery
			isClusterHourlyData: $isClusterHourlyData
			groupBy: $groupBy
			preferences: $preferences
		) {
			cost {
				statsLabel
				statsTrend
				statsValue
				statsDescription
				value
				__typename
			}
			__typename
		}
	}
`
const CCMPerspectiveBudgetQuery = `
query FetchPerspectiveBudget($perspectiveId: String) {
	budgetSummaryList(perspectiveId: $perspectiveId) {
		id
		name
		budgetAmount
		actualCost
		timeLeft
		timeUnit
		timeScope
		period
		folderId
		__typename
	}
}
`

const CCMMetadataQuery = `
query FetchCcmMetaData {
  ccmMetaData {
    k8sClusterConnectorPresent
    cloudDataPresent
    awsConnectorsPresent
    gcpConnectorsPresent
    azureConnectorsPresent
    applicationDataPresent
    inventoryDataPresent
    clusterDataPresent
    externalDataPresent
    isSampleClusterPresent
    defaultAzurePerspectiveId
    defaultAwsPerspectiveId
    defaultGcpPerspectiveId
    defaultClusterPerspectiveId
    defaultExternalDataPerspectiveId
    showCostOverview
    currencyPreference {
      destinationCurrency
      symbol
      locale
      setupTime
      __typename
    }
    __typename
  }
}
`
const CCMPerspectiveRecommendationsQuery = `
query PerspectiveRecommendations($filter: RecommendationFilterDTOInput) {
	recommendationStatsV2(filter: $filter) {
		totalMonthlyCost
		totalMonthlySaving
		count
		__typename
	}
	recommendationsV2(filter: $filter) {
		items {
			clusterName
			namespace
			id
			resourceType
			resourceName
			monthlyCost
			monthlySaving
			__typename
		}
		__typename
	}
}
`
