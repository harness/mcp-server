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
